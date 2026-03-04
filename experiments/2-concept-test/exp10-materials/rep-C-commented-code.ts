/**
 * =============================================================================
 * TeamCollectionService — Central service for all team collection operations
 * =============================================================================
 *
 * RESPONSIBILITY:
 * Coordinates Prisma database transactions with pessimistic row locking,
 * maintains orderIndex consistency across sibling sets, prevents circular tree
 * structures, and publishes real-time PubSub events after every mutation.
 *
 * IN SCOPE:
 *   - Collection CRUD: create, rename, update (title/data), delete with sibling reindexing
 *   - Tree operations: move collection (to root or into another collection), reorder siblings, sort
 *   - Tree integrity: recursive ancestor check (isParent) to prevent circular moves
 *   - Import/export: recursive JSON serialization/deserialization of entire subtrees
 *   - Search: raw SQL with ILIKE + similarity() fuzzy matching, recursive CTE for breadcrumbs
 *   - Duplication: export-then-import with title modification
 *   - CLI support: getCollectionForCLI, getCollectionTreeForCLI
 *
 * OUT OF SCOPE:
 *   - Authentication/authorization (handled by resolvers and guards)
 *   - Individual request CRUD (separate TeamRequest service)
 *   - Team membership management (delegated to TeamService)
 *   - PubSub infrastructure (delegated to PubSubService)
 *
 * KEY DESIGN DECISIONS:
 *
 *   1. PESSIMISTIC LOCKING (not optimistic): Every operation that reads and then
 *      modifies sibling orderIndex values acquires a row lock first via
 *      lockTeamCollectionByTeamAndParent(). Optimistic locking (version columns +
 *      retry on conflict) was rejected because reorder operations touch MANY siblings
 *      via updateMany — a single conflicting row would invalidate the entire batch.
 *      Lock scope is (teamID, parentID) so different subtrees don't block each other.
 *
 *   2. INTEGER orderIndex (not fractional): Values are contiguous starting from 1.
 *      Every mutation maintains this invariant. Fractional ordering avoids touching
 *      siblings but eventually needs rebalancing when precision is exhausted. For a
 *      real-time collaborative tool, integer ordering is simpler to reason about.
 *
 *   3. RANGE-SHIFT for reorder (not swap): Moving an item shifts the affected range
 *      up or down by 1, maintaining contiguity. Swap only works for adjacent items.
 *
 *   4. EXPORT+IMPORT for duplication (not deep-copy): Reuses existing recursive import
 *      logic. Trade-off: serialization round-trip overhead but zero code duplication.
 *
 *   5. WALK-UP for cycle detection (not walk-down): isParent walks from destination
 *      to root (O(depth)) instead of loading entire source subtree (O(subtree_size)).
 *
 *   6. RETRY only on delete (not all mutations): Delete can race with concurrent
 *      deletes on overlapping sibling ranges. Other mutations rely solely on locking.
 *      Linear backoff (100ms increments, max 5 retries, max 1.5s total wait).
 *
 *   7. PubSub events AFTER transaction commit: Prevents phantom events where
 *      clients see updates for rolled-back transactions.
 *
 * CROSS-CUTTING PATTERNS:
 *   - fp-ts Either/Option for error handling (never throw for business errors)
 *   - Prisma ORM for database access
 *   - PubSub channels: team_coll/${teamID}/coll_added|updated|removed|moved|order_updated
 *
 * CONSTRAINTS:
 *   - OrderIndex contiguity: within (teamID, parentID), always 1..N with no gaps
 *   - Circular reference prevention: isParent check before every move
 *   - Same-team constraint: cross-team moves rejected
 *   - Self-move prevention: collection cannot move into itself or reorder next to itself
 *   - Title minimum length: at least 1 character
 *   - Data field: must be valid JSON if provided; empty string explicitly rejected
 *
 * =============================================================================
 */

import { ConflictException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TeamCollection } from './team-collection.model';
import {
  TEAM_COLL_SHORT_TITLE,
  TEAM_COLL_INVALID_JSON,
  TEAM_INVALID_COLL_ID,
  TEAM_NOT_OWNER,
  TEAM_COLL_NOT_FOUND,
  TEAM_COL_ALREADY_ROOT,
  TEAM_COLL_DEST_SAME,
  TEAM_COLL_NOT_SAME_TEAM,
  TEAM_COLL_IS_PARENT_COLL,
  TEAM_COL_SAME_NEXT_COLL,
  TEAM_COL_REORDERING_FAILED,
  TEAM_COLL_DATA_INVALID,
  TEAM_REQ_SEARCH_FAILED,
  TEAM_COL_SEARCH_FAILED,
  TEAM_REQ_PARENT_TREE_GEN_FAILED,
  TEAM_COLL_PARENT_TREE_GEN_FAILED,
  TEAM_MEMBER_NOT_FOUND,
  TEAM_COLL_CREATION_FAILED,
} from '../errors';
import { PubSubService } from '../pubsub/pubsub.service';
import {
  delay,
  escapeSqlLikeString,
  isValidLength,
  transformCollectionData,
  stringToJson,
} from 'src/utils';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {
  Prisma,
  TeamCollection as DBTeamCollection,
  TeamRequest,
} from 'src/generated/prisma/client';
import { CollectionFolder } from 'src/types/CollectionFolder';
import { CollectionSearchNode } from 'src/types/CollectionSearchNode';
import {
  GetCollectionResponse,
  ParentTreeQueryReturnType,
  SearchQueryReturnType,
} from './helper';
import { RESTError } from 'src/types/RESTError';
import { TeamService } from 'src/team/team.service';
import { PrismaError } from 'src/prisma/prisma-error-codes';
import { SortOptions } from 'src/types/SortOptions';

@Injectable()
export class TeamCollectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pubsub: PubSubService,
    private readonly teamService: TeamService,
  ) {}

  // CONSTRAINT: Title must be at least 1 character. Empty titles are rejected
  // with TEAM_COLL_SHORT_TITLE. This is a business rule, not a DB constraint.
  TITLE_LENGTH = 1;

  // DECISION: Max retries = 5 with linear backoff (retryCount * 100ms).
  // Maximum total wait is 1.5 seconds. We use linear (not exponential) because
  // the lock contention window is short (sibling set under one parent) and
  // linear backoff provides sufficient jitter without excessive delays.
  MAX_RETRIES = 5; // Maximum number of retries for database transactions

  /**
   * Generate a Prisma query object representation of a collection and its
   * child collections and requests.
   *
   * Used by the import pipeline. Recursively builds a nested Prisma create
   * query that materializes an entire collection subtree in one operation.
   * OrderIndex values are assigned sequentially (index + 1) for both
   * collections and requests, maintaining the contiguity invariant.
   */
  private generatePrismaQueryObjForFBCollFolder(
    folder: CollectionFolder,
    teamID: string,
    orderIndex: number,
  ): Prisma.TeamCollectionCreateInput {
    return {
      title: folder.name,
      team: {
        connect: {
          id: teamID,
        },
      },
      requests: {
        // PATTERN: Requests within a collection also use 1-based contiguous orderIndex
        create: folder.requests.map((r, index) => ({
          title: r.name,
          team: {
            connect: {
              id: teamID,
            },
          },
          request: r,
          orderIndex: index + 1,
        })),
      },
      orderIndex: orderIndex,
      children: {
        // PATTERN: Recursive — each child folder generates its own nested create
        // with orderIndex starting from 1 within its own sibling set
        create: folder.folders.map((f, index) =>
          this.generatePrismaQueryObjForFBCollFolder(f, teamID, index + 1),
        ),
      },
      data: folder.data ?? undefined,
    };
  }

  /**
   * Recursively export a collection and all its descendants to a JSON object.
   *
   * This is one half of the export+import pipeline used by duplication (ADR-003).
   * Walks the tree depth-first, serializing each level's collections and requests
   * into a CollectionFolder structure. Request data is parsed from DB format
   * (may be stored as string or object).
   */
  async exportCollectionToJSONObject(
    teamID: string,
    collectionID: string,
  ): Promise<E.Right<CollectionFolder> | E.Left<string>> {
    const collection = await this.getCollection(collectionID);
    if (E.isLeft(collection)) return E.left(TEAM_INVALID_COLL_ID);

    const childrenCollectionObjects = [];

    const childrenCollection = await this.prisma.teamCollection.findMany({
      where: {
        teamID,
        parentID: collectionID,
      },
      orderBy: {
        orderIndex: 'asc',
      },
    });

    for (const coll of childrenCollection) {
      const result = await this.exportCollectionToJSONObject(teamID, coll.id);
      if (E.isLeft(result)) return E.left(result.left);

      childrenCollectionObjects.push(result.right);
    }

    const requests = await this.prisma.teamRequest.findMany({
      where: {
        teamID,
        collectionID,
      },
      orderBy: {
        orderIndex: 'asc',
      },
    });

    const data = transformCollectionData(collection.right.data);

    const result: CollectionFolder = {
      id: collection.right.id,
      name: collection.right.title,
      folders: childrenCollectionObjects,
      requests: requests.map((x) => {
        const requestData =
          typeof x.request === 'string' ? JSON.parse(x.request) : x.request;
        return {
          ...requestData,
          id: x.id,
        };
      }),
      data,
    };

    return E.right(result);
  }

  /**
   * Export ALL root collections for a team to a JSON string.
   * Used for full-team backup/export.
   */
  async exportCollectionsToJSON(teamID: string) {
    const rootCollections = await this.prisma.teamCollection.findMany({
      where: {
        teamID,
        parentID: null,
      },
    });

    const rootCollectionObjects = [];
    for (const coll of rootCollections) {
      const result = await this.exportCollectionToJSONObject(teamID, coll.id);
      if (E.isLeft(result)) return E.left(result.left);

      rootCollectionObjects.push(result.right);
    }

    return E.right(JSON.stringify(rootCollectionObjects));
  }

  /**
   * Import collections from a JSON string into a team.
   *
   * This is the other half of the export+import pipeline (ADR-003).
   *
   * PATTERN: PESSIMISTIC LOCKING
   * The import acquires a lock on the parent's sibling set before reading the
   * last orderIndex. This prevents concurrent imports from assigning the same
   * orderIndex values. Without locking, two concurrent imports could both read
   * lastOrderIndex=3 and both start assigning from 4.
   *
   * PATTERN: PubSub AFTER COMMIT
   * The pubsub.publish calls happen AFTER the transaction block completes
   * successfully. If the transaction rolls back, no events are emitted,
   * preventing phantom updates to connected clients.
   */
  async importCollectionsFromJSON(
    jsonString: string,
    teamID: string,
    parentID: string | null,
  ) {
    // Check to see if jsonString is valid
    const collectionsList = stringToJson<CollectionFolder[]>(jsonString);
    if (E.isLeft(collectionsList)) return E.left(TEAM_COLL_INVALID_JSON);

    // Check to see if parsed jsonString is an array
    if (!Array.isArray(collectionsList.right))
      return E.left(TEAM_COLL_INVALID_JSON);

    let teamCollections: DBTeamCollection[] = [];
    let queryList: Prisma.TeamCollectionCreateInput[] = [];
    try {
      await this.prisma.$transaction(async (tx) => {
        try {
          // PATTERN: PESSIMISTIC LOCKING — lock sibling rows under this parent
          // before reading the last orderIndex. Scoped to (teamID, parentID),
          // so imports into different parents can proceed in parallel.
          await this.prisma.lockTeamCollectionByTeamAndParent(
            tx,
            teamID,
            parentID,
          );

          // INVARIANT: orderIndex contiguity — new collections get lastIndex + 1,
          // lastIndex + 2, etc., extending the contiguous 1..N sequence.
          const lastEntry = await tx.teamCollection.findFirst({
            where: { teamID, parentID },
            orderBy: { orderIndex: 'desc' },
            select: { orderIndex: true },
          });
          let lastOrderIndex = lastEntry ? lastEntry.orderIndex : 0;

          // Generate Prisma Query Object for all child collections in collectionsList
          queryList = collectionsList.right.map((x) =>
            this.generatePrismaQueryObjForFBCollFolder(
              x,
              teamID,
              ++lastOrderIndex,
            ),
          );

          const promises = queryList.map((query) =>
            tx.teamCollection.create({
              data: {
                ...query,
                parent: parentID ? { connect: { id: parentID } } : undefined,
              },
            }),
          );
          teamCollections = await Promise.all(promises);
        } catch (error) {
          throw new ConflictException(error);
        }
      });
    } catch (error) {
      console.error(
        'Error from TeamCollectionService.importCollectionsFromJSON',
        error,
      );
      return E.left(TEAM_COLL_CREATION_FAILED);
    }

    // PATTERN: PubSub events AFTER transaction commit — ensures no phantom events
    // for rolled-back transactions. Each imported top-level collection gets its
    // own coll_added event.
    teamCollections.forEach((collection) =>
      this.pubsub.publish(
        `team_coll/${teamID}/coll_added`,
        this.cast(collection),
      ),
    );

    return E.right(teamCollections);
  }

  /**
   * Typecast a database TeamCollection to a TeamCollection model.
   * Handles the data field transformation (DB JSON -> application format).
   */
  private cast(teamCollection: DBTeamCollection): TeamCollection {
    const data = transformCollectionData(teamCollection.data);

    return <TeamCollection>{
      id: teamCollection.id,
      title: teamCollection.title,
      parentID: teamCollection.parentID,
      data,
    };
  }

  /**
   * Get Team of given Collection ID
   */
  async getTeamOfCollection(collectionID: string) {
    try {
      const teamCollection = await this.prisma.teamCollection.findUnique({
        where: {
          id: collectionID,
        },
        include: {
          team: true,
        },
      });

      return E.right(teamCollection.team);
    } catch (error) {
      return E.left(TEAM_INVALID_COLL_ID);
    }
  }

  /**
   * Get parent of given Collection ID
   */
  async getParentOfCollection(collectionID: string) {
    const teamCollection = await this.prisma.teamCollection.findUnique({
      where: {
        id: collectionID,
      },
      include: {
        parent: true,
      },
    });
    if (!teamCollection) return null;

    return !teamCollection.parent ? null : this.cast(teamCollection.parent);
  }

  /**
   * Get child collections of given Collection ID.
   * Uses cursor-based pagination ordered by orderIndex.
   *
   * NOTE: The contiguous integer orderIndex invariant (ADR-002) is critical
   * here — it ensures cursor-based pagination is reliable and predictable.
   * With fractional ordering, cursor-based pagination would be fragile.
   */
  async getChildrenOfCollection(
    collectionID: string,
    cursor: string | null,
    take: number,
  ) {
    const res = await this.prisma.teamCollection.findMany({
      where: {
        parentID: collectionID,
      },
      orderBy: {
        orderIndex: 'asc',
      },
      take: take, // default: 10
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
    });

    const childCollections = res.map((teamCollection) =>
      this.cast(teamCollection),
    );

    return childCollections;
  }

  /**
   * Get root collections of a team.
   * Root collections have parentID = null.
   */
  async getTeamRootCollections(
    teamID: string,
    cursor: string | null,
    take: number,
  ) {
    const res = await this.prisma.teamCollection.findMany({
      where: {
        teamID,
        parentID: null,
      },
      orderBy: {
        orderIndex: 'asc',
      },
      take: take, // default: 10
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
    });

    const teamCollections = res.map((teamCollection) =>
      this.cast(teamCollection),
    );

    return teamCollections;
  }

  /**
   * Get collection details. Optionally accepts a transaction client
   * for use within an existing transaction (e.g., inside isParent or moveCollection).
   */
  async getCollection(
    collectionID: string,
    tx: Prisma.TransactionClient | null = null,
  ) {
    try {
      const teamCollection = await (
        tx || this.prisma
      ).teamCollection.findUniqueOrThrow({
        where: {
          id: collectionID,
        },
      });
      return E.right(teamCollection);
    } catch (error) {
      return E.left(TEAM_COLL_NOT_FOUND);
    }
  }

  /**
   * Check to see if Collection belongs to Team.
   * Used as a guard before operations that require ownership verification.
   */
  private async isOwnerCheck(collectionID: string, teamID: string) {
    try {
      await this.prisma.teamCollection.findFirstOrThrow({
        where: {
          id: collectionID,
          teamID,
        },
      });

      return O.some(true);
    } catch (error) {
      return O.none;
    }
  }

  /**
   * Create a new TeamCollection.
   *
   * PATTERN: PESSIMISTIC LOCKING
   * Acquires a row lock on the sibling set under the target parent before
   * reading the last orderIndex. This prevents two concurrent creates from
   * both reading the same last index and assigning duplicate orderIndex values.
   *
   * INVARIANT: OrderIndex contiguity
   * New collection is always created at lastIndex + 1 (or 1 if no siblings).
   * The contiguous 1..N sequence is extended, never broken.
   *
   * CONSTRAINT: Data field validation
   * Empty string is explicitly rejected (not treated as null). If data is
   * provided, it must be valid JSON. This is a deliberate choice — the empty
   * string case is a common client bug that should be caught early.
   *
   * PATTERN: PubSub AFTER COMMIT
   * The coll_added event is published only after the transaction succeeds.
   */
  async createCollection(
    teamID: string,
    title: string,
    data: string | null = null,
    parentID: string | null,
  ) {
    const isTitleValid = isValidLength(title, this.TITLE_LENGTH);
    if (!isTitleValid) return E.left(TEAM_COLL_SHORT_TITLE);

    // CONSTRAINT: Same-team — parent must belong to this team
    if (parentID !== null) {
      const isOwner = await this.isOwnerCheck(parentID, teamID);
      if (O.isNone(isOwner)) return E.left(TEAM_NOT_OWNER);
    }

    // CONSTRAINT: Data field — empty string explicitly rejected, not treated as null
    if (data === '') return E.left(TEAM_COLL_DATA_INVALID);
    if (data) {
      const jsonReq = stringToJson(data);
      if (E.isLeft(jsonReq)) return E.left(TEAM_COLL_DATA_INVALID);
      data = jsonReq.right;
    }

    let teamCollection: DBTeamCollection | null = null;
    try {
      teamCollection = await this.prisma.$transaction(async (tx) => {
        try {
          // PATTERN: PESSIMISTIC LOCKING — lock siblings under this parent
          await this.prisma.lockTeamCollectionByTeamAndParent(
            tx,
            teamID,
            parentID,
          );

          // Read last orderIndex while holding the lock
          const lastCollection = await tx.teamCollection.findFirst({
            where: { teamID, parentID },
            orderBy: { orderIndex: 'desc' },
            select: { orderIndex: true },
          });

          // INVARIANT: New collection at lastIndex + 1 (or 1 if empty)
          return tx.teamCollection.create({
            data: {
              title,
              teamID,
              parentID: parentID ? parentID : undefined,
              data: data ?? undefined,
              orderIndex: lastCollection ? lastCollection.orderIndex + 1 : 1,
            },
          });
        } catch (error) {
          throw new ConflictException(error);
        }
      });
    } catch (error) {
      console.error('Error from TeamCollectionService.createCollection', error);
      return E.left(TEAM_COLL_CREATION_FAILED);
    }

    // PATTERN: PubSub AFTER COMMIT — event only if transaction succeeded
    this.pubsub.publish(
      `team_coll/${teamID}/coll_added`,
      this.cast(teamCollection),
    );

    return E.right(this.cast(teamCollection));
  }

  /**
   * @deprecated Use updateTeamCollection method instead
   * Update the title of a TeamCollection.
   * No locking needed — title changes don't affect orderIndex.
   */
  async renameCollection(collectionID: string, newTitle: string) {
    const isTitleValid = isValidLength(newTitle, this.TITLE_LENGTH);
    if (!isTitleValid) return E.left(TEAM_COLL_SHORT_TITLE);

    try {
      const updatedTeamCollection = await this.prisma.teamCollection.update({
        where: { id: collectionID },
        data: { title: newTitle },
      });

      this.pubsub.publish(
        `team_coll/${updatedTeamCollection.teamID}/coll_updated`,
        this.cast(updatedTeamCollection),
      );

      return E.right(this.cast(updatedTeamCollection));
    } catch (error) {
      return E.left(TEAM_COLL_NOT_FOUND);
    }
  }

  /**
   * Delete a collection and reindex its siblings.
   *
   * PATTERN: RETRY ON DEADLOCK (ADR-005)
   * This is the ONLY method with a retry loop. Delete+reindex can race with
   * other concurrent deletes on the same sibling set: two transactions each
   * lock, then try to decrement overlapping ranges. When lock acquisition
   * order differs, deadlocks occur. The retry loop handles these transient
   * failures.
   *
   * Why only delete and not other mutations? Create and move operations are
   * less prone to deadlocks because they typically modify non-overlapping
   * index ranges (append at end, or shift in one direction). Delete operations
   * specifically race when two deletes target the same sibling set because
   * both need to decrement overlapping "greater than" ranges.
   *
   * RETRY CONDITIONS:
   * - UNIQUE_CONSTRAINT_VIOLATION: two operations assigned the same orderIndex
   * - TRANSACTION_DEADLOCK: two transactions locked rows in conflicting order
   * - TRANSACTION_TIMEOUT: lock wait exceeded timeout
   * Any other database error is NOT retried — it indicates a non-transient problem.
   *
   * STRATEGY: Linear backoff at retryCount * 100ms (100, 200, 300, 400, 500ms).
   * Why linear, not exponential? The lock contention window is short (sibling set
   * under one parent). Linear provides sufficient jitter. Max total wait: 1.5s.
   *
   * INVARIANT: After deletion, all siblings with orderIndex > deleted item's
   * orderIndex are decremented by 1, maintaining contiguous 1..N sequence.
   */
  private async deleteCollectionAndUpdateSiblingsOrderIndex(
    collection: DBTeamCollection,
    orderIndexCondition: Prisma.IntFilter,
    dataCondition: Prisma.IntFieldUpdateOperationsInput,
  ) {
    let retryCount = 0;
    while (retryCount < this.MAX_RETRIES) {
      try {
        await this.prisma.$transaction(async (tx) => {
          try {
            // PATTERN: PESSIMISTIC LOCKING — lock siblings before delete+reindex
            await this.prisma.lockTeamCollectionByTeamAndParent(
              tx,
              collection.teamID,
              collection.parentID,
            );

            // Delete the collection (cascading deletes handled by DB constraints)
            const deletedCollection = await tx.teamCollection.delete({
              where: { id: collection.id },
            });

            // INVARIANT: Maintain orderIndex contiguity — fill the gap left by deletion.
            // Only reindex if the collection was actually found and deleted.
            // If it was already deleted by a concurrent transaction (race condition),
            // skip reindexing to avoid corrupting the sibling order.
            if (deletedCollection) {
              await tx.teamCollection.updateMany({
                where: {
                  teamID: collection.teamID,
                  parentID: collection.parentID,
                  orderIndex: orderIndexCondition,
                },
                data: { orderIndex: dataCondition },
              });
            }
          } catch (error) {
            throw new ConflictException(error);
          }
        });

        break; // Transaction succeeded, exit retry loop
      } catch (error) {
        console.error(
          'Error from TeamCollectionService.updateOrderIndex',
          error,
        );
        retryCount++;
        // Only retry on transient DB errors (deadlocks, unique constraint races, timeouts).
        // All other errors are non-transient and should fail immediately.
        if (
          retryCount >= this.MAX_RETRIES ||
          (error.code !== PrismaError.UNIQUE_CONSTRAINT_VIOLATION &&
            error.code !== PrismaError.TRANSACTION_DEADLOCK &&
            error.code !== PrismaError.TRANSACTION_TIMEOUT) // return for all DB error except deadlocks, unique constraint violations, transaction timeouts
        )
          return E.left(TEAM_COL_REORDERING_FAILED);

        // Linear backoff: 100ms, 200ms, 300ms, 400ms, 500ms
        await delay(retryCount * 100);
        console.debug(`Retrying updateOrderIndex... (${retryCount})`);
      }
    }

    return E.right(true);
  }

  /**
   * Delete a collection and publish the removal event.
   *
   * INVARIANT: After deletion, siblings with orderIndex > deleted are decremented.
   * PATTERN: PubSub event (coll_removed) emitted AFTER the retry loop succeeds.
   * PAYLOAD: Just the collection ID string (not the full object), since the
   * collection no longer exists in the database.
   */
  async deleteCollection(collectionID: string) {
    const collection = await this.getCollection(collectionID);
    if (E.isLeft(collection)) return E.left(collection.left);

    // Delegate to retry-enabled delete method. The orderIndexCondition
    // targets all siblings with orderIndex > the deleted collection's index,
    // and the dataCondition decrements them by 1 to fill the gap.
    const isDeleted = await this.deleteCollectionAndUpdateSiblingsOrderIndex(
      collection.right,
      { gt: collection.right.orderIndex },
      { decrement: 1 },
    );
    if (E.isLeft(isDeleted)) return E.left(isDeleted.left);

    // PATTERN: PubSub AFTER COMMIT — coll_removed payload is just the ID
    this.pubsub.publish(
      `team_coll/${collection.right.teamID}/coll_removed`,
      collection.right.id,
    );

    return E.right(true);
  }

  /**
   * Move a collection from one parent to another, updating orderIndexes in
   * BOTH the source and destination parent sibling sets.
   *
   * DECISION: This is a TWO-PARENT operation within a single transaction.
   * It modifies sibling indexes in BOTH the source and destination parents:
   *   1. Find last orderIndex under new parent
   *   2. Decrement all siblings after the collection in its ORIGINAL parent
   *      (fills the gap left behind)
   *   3. Update collection: set parentID = new parent, orderIndex = last + 1
   *      under new parent
   *
   * Both parent groups are effectively locked by the surrounding transaction.
   */
  private async changeParentAndUpdateOrderIndex(
    tx: Prisma.TransactionClient,
    collection: DBTeamCollection,
    newParentID: string | null,
  ) {
    // Find where to place the collection in the new parent's sibling set
    const lastCollectionUnderNewParent = await tx.teamCollection.findFirst({
      where: { teamID: collection.teamID, parentID: newParentID },
      orderBy: { orderIndex: 'desc' },
    });

    // INVARIANT: Fill the gap in the SOURCE parent's sibling set.
    // All siblings that came after this collection get decremented by 1.
    await tx.teamCollection.updateMany({
      where: {
        teamID: collection.teamID,
        parentID: collection.parentID,
        orderIndex: { gt: collection.orderIndex },
      },
      data: {
        orderIndex: { decrement: 1 },
      },
    });

    // INVARIANT: Append at end of DESTINATION parent's sibling set.
    const updatedCollection = await tx.teamCollection.update({
      where: { id: collection.id },
      data: {
        parentID: newParentID,
        orderIndex: lastCollectionUnderNewParent
          ? lastCollectionUnderNewParent.orderIndex + 1
          : 1,
      },
    });

    return E.right(this.cast(updatedCollection));
  }

  /**
   * Check if source collection is an ancestor of destination collection.
   *
   * DECISION: WALK UP, NOT DOWN (ADR-004)
   * To check if Collection_A is an ancestor of Collection_D, we walk UP from D
   * to root (following parentID links), checking if any parent is A. The
   * alternative — walking DOWN from A through all descendants — would require
   * loading the entire subtree, which is O(subtree_size). Walking up follows a
   * single chain of parentID pointers, which is O(depth).
   *
   * ALGORITHM:
   *   1. If source === destination → return None (invalid, self-move)
   *   2. If destination.parentID === source.id → return None (cycle detected)
   *   3. If destination.parentID !== null → recurse with destination = parent
   *   4. If destination.parentID === null → reached root, safe → return Some(true)
   *
   * Return values (fp-ts Option):
   *   O.none = invalid (would create cycle)
   *   O.some(true) = valid (safe to move)
   */
  private async isParent(
    collection: DBTeamCollection,
    destCollection: DBTeamCollection,
    tx: Prisma.TransactionClient | null = null,
  ): Promise<O.Option<boolean>> {
    //* Recursively check if collection is a parent by going up the tree of child-parent collections until we reach a root collection i.e parentID === null
    //* Valid condition, isParent returns false
    //* Consider us moving Collection_E into Collection_D
    //* Collection_A              [parent:null !== Collection_E] return false, exit
    //*   |--> Collection_B       [parent:Collection_A !== Collection_E] call isParent(Collection_E,Collection_A)
    //*      |--> Collection_C    [parent:Collection_B !== Collection_E] call isParent(Collection_E,Collection_B)
    //*         |--> Collection_D [parent:Collection_C !== Collection_E] call isParent(Collection_E,Collection_C)
    //* Invalid condition, isParent returns true
    //* Consider us moving Collection_B into Collection_D
    //* Collection_A
    //*   |--> Collection_B
    //*      |--> Collection_C    [parent:Collection_B === Collection_B] return true, exit
    //*         |--> Collection_D [parent:Collection_C !== Collection_B] call isParent(Collection_B,Collection_C)

    // Check if collection and destCollection are same
    if (collection === destCollection) {
      return O.none;
    }
    if (destCollection.parentID !== null) {
      // Check if ID of collection is same as parent of destCollection
      if (destCollection.parentID === collection.id) {
        return O.none;
      }
      // Get collection details of collection one step above in the tree i.e the parent collection
      const parentCollection = await this.getCollection(
        destCollection.parentID,
        tx,
      );
      if (E.isLeft(parentCollection)) {
        return O.none;
      }
      // Call isParent again now with parent collection
      return await this.isParent(collection, parentCollection.right, tx);
    } else {
      return O.some(true);
    }
  }

  /**
   * Move a collection into root or into another collection.
   *
   * CONSTRAINTS enforced:
   *   - TEAM_COL_ALREADY_ROOT: Moving root collection to root is a no-op, rejected
   *   - TEAM_COLL_DEST_SAME: Cannot move collection into itself
   *   - TEAM_COLL_NOT_SAME_TEAM: Cross-team moves rejected
   *   - TEAM_COLL_IS_PARENT_COLL: Cannot move into own descendant (cycle detection via isParent)
   *
   * PATTERN: PESSIMISTIC LOCKING — locks both source and destination parent
   * sibling sets within the same transaction.
   *
   * PATTERN: PubSub AFTER COMMIT — coll_moved event includes full updated collection.
   */
  async moveCollection(collectionID: string, destCollectionID: string | null) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Get collection details of collectionID
        const collection = await this.getCollection(collectionID, tx);
        if (E.isLeft(collection)) return E.left(collection.left);

        // PATTERN: Lock source parent's siblings first
        await this.prisma.lockTeamCollectionByTeamAndParent(
          tx,
          collection.right.teamID,
          collection.right.parentID,
        );

        // destCollectionID == null i.e move collection to root
        if (!destCollectionID) {
          // CONSTRAINT: Already-root guard — prevent no-op moves
          if (!collection.right.parentID) {
            return E.left(TEAM_COL_ALREADY_ROOT);
          }

          const updatedCollection = await this.changeParentAndUpdateOrderIndex(
            tx,
            collection.right,
            null,
          );
          if (E.isLeft(updatedCollection))
            return E.left(updatedCollection.left);

          // PATTERN: PubSub AFTER COMMIT
          this.pubsub.publish(
            `team_coll/${collection.right.teamID}/coll_moved`,
            updatedCollection.right,
          );

          return E.right(updatedCollection.right);
        }

        // CONSTRAINT: Self-move prevention
        if (collectionID === destCollectionID) {
          return E.left(TEAM_COLL_DEST_SAME);
        }

        const destCollection = await this.getCollection(destCollectionID, tx);
        if (E.isLeft(destCollection)) return E.left(TEAM_COLL_NOT_FOUND);

        // CONSTRAINT: Same-team — cross-team moves rejected
        if (collection.right.teamID !== destCollection.right.teamID) {
          return E.left(TEAM_COLL_NOT_SAME_TEAM);
        }

        // CONSTRAINT: Circular reference prevention (ADR-004)
        // Walk UP from destination to root, checking if source is an ancestor
        const checkIfParent = await this.isParent(
          collection.right,
          destCollection.right,
          tx,
        );
        if (O.isNone(checkIfParent)) {
          return E.left(TEAM_COLL_IS_PARENT_COLL);
        }

        // PATTERN: Lock destination parent's siblings too (two-parent operation)
        await this.prisma.lockTeamCollectionByTeamAndParent(
          tx,
          destCollection.right.teamID,
          destCollection.right.parentID,
        );

        const updatedCollection = await this.changeParentAndUpdateOrderIndex(
          tx,
          collection.right,
          destCollection.right.id,
        );
        if (E.isLeft(updatedCollection)) return E.left(updatedCollection.left);

        // PATTERN: PubSub AFTER COMMIT
        this.pubsub.publish(
          `team_coll/${collection.right.teamID}/coll_moved`,
          updatedCollection.right,
        );

        return E.right(updatedCollection.right);
      });
    } catch (error) {
      console.error('Error from TeamCollectionService.moveCollection', error);
      return E.left(TEAM_COL_REORDERING_FAILED);
    }
  }

  /**
   * Count child collections under a parent.
   * Used by reorder to determine the "end" position.
   */
  getCollectionCount(
    collectionID: string,
    teamID: string,
    tx: Prisma.TransactionClient | null = null,
  ): Promise<number> {
    return (tx || this.prisma).teamCollection.count({
      where: { parentID: collectionID, teamID: teamID },
    });
  }

  /**
   * Reorder a collection within its sibling set.
   *
   * DECISION: RANGE-SHIFT ALGORITHM (ADR-007), not swap.
   * Uses "next collection" semantics: the client specifies "place me just
   * before this collection" (or null for "move to end").
   *
   * Two cases:
   *
   * CASE 1 — Move to end (nextCollectionID = null):
   *   1. Lock siblings
   *   2. Re-read collection's orderIndex inside transaction (race condition guard)
   *   3. Decrement all siblings with orderIndex > current (fills the gap)
   *   4. Set collection's orderIndex = total count of siblings (end position)
   *
   * CASE 2 — Move to specific position (nextCollectionID != null):
   *   1. Lock siblings
   *   2. Re-read BOTH collection and nextCollection orderIndex inside transaction
   *   3. Determine direction: isMovingUp = nextCollection.orderIndex < collection.orderIndex
   *   4. If moving UP: increment range [nextColl.orderIndex, coll.orderIndex - 1]
   *   5. If moving DOWN: decrement range [coll.orderIndex + 1, nextColl.orderIndex - 1]
   *   6. Set collection's orderIndex: if up → nextColl.orderIndex, if down → nextColl.orderIndex - 1
   *
   * IMPORTANT: Both paths re-read orderIndex values INSIDE the transaction after
   * acquiring the lock. This guards against race conditions where the orderIndex
   * changed between the initial read (outside the transaction) and lock acquisition.
   *
   * PATTERN: PESSIMISTIC LOCKING
   * PATTERN: PubSub AFTER COMMIT — coll_order_updated with { collection, nextCollection }
   */
  async updateCollectionOrder(
    collectionID: string,
    nextCollectionID: string | null,
  ) {
    // CONSTRAINT: Self-reorder prevention
    if (collectionID === nextCollectionID)
      return E.left(TEAM_COL_SAME_NEXT_COLL);

    // Get collection details of collectionID
    const collection = await this.getCollection(collectionID);
    if (E.isLeft(collection)) return E.left(collection.left);

    if (!nextCollectionID) {
      // CASE 1: Move to end of the list
      try {
        await this.prisma.$transaction(async (tx) => {
          try {
            // PATTERN: PESSIMISTIC LOCKING
            await this.prisma.lockTeamCollectionByTeamAndParent(
              tx,
              collection.right.teamID,
              collection.right.parentID,
            );

            // Re-read orderIndex inside transaction — race condition guard.
            // The collection's orderIndex may have changed between our initial
            // read (above) and when we acquired the lock.
            const collectionInTx = await tx.teamCollection.findFirst({
              where: { id: collection.right.id },
              select: { orderIndex: true },
            });

            // Guard against concurrent deletion
            if (collectionInTx) {
              // Step 1: Fill the gap — decrement all siblings after this one
              await tx.teamCollection.updateMany({
                where: {
                  teamID: collection.right.teamID,
                  parentID: collection.right.parentID,
                  orderIndex: {
                    gte: collectionInTx.orderIndex + 1,
                  },
                },
                data: {
                  orderIndex: { decrement: 1 },
                },
              });

              // Step 2: Place at end — orderIndex = total sibling count
              await tx.teamCollection.update({
                where: { id: collection.right.id },
                data: {
                  orderIndex: await this.getCollectionCount(
                    collection.right.parentID,
                    collection.right.teamID,
                    tx,
                  ),
                },
              });
            }
          } catch (error) {
            throw new ConflictException(error);
          }
        });

        // PATTERN: PubSub AFTER COMMIT
        this.pubsub.publish(
          `team_coll/${collection.right.teamID}/coll_order_updated`,
          {
            collection: this.cast(collection.right),
            nextCollection: null,
          },
        );

        return E.right(true);
      } catch (error) {
        return E.left(TEAM_COL_REORDERING_FAILED);
      }
    }

    // CASE 2: Move to specific position (just before nextCollectionID)
    const subsequentCollection = await this.getCollection(nextCollectionID);
    if (E.isLeft(subsequentCollection)) return E.left(TEAM_COLL_NOT_FOUND);

    // CONSTRAINT: Same-team check
    if (collection.right.teamID !== subsequentCollection.right.teamID)
      return E.left(TEAM_COLL_NOT_SAME_TEAM);

    try {
      await this.prisma.$transaction(async (tx) => {
        try {
          // PATTERN: PESSIMISTIC LOCKING
          await this.prisma.lockTeamCollectionByTeamAndParent(
            tx,
            collection.right.teamID,
            collection.right.parentID,
          );

          // Re-read BOTH orderIndexes inside transaction — race condition guard
          const collectionInTx = await tx.teamCollection.findFirst({
            where: { id: collectionID },
            select: { orderIndex: true },
          });
          const subsequentCollectionInTx = await tx.teamCollection.findFirst({
            where: { id: nextCollectionID },
            select: { orderIndex: true },
          });

          // Guard against concurrent deletion of either collection
          if (collectionInTx && subsequentCollectionInTx) {
            // ALGORITHM: Range-shift (ADR-007)
            // Determine direction based on relative position
            const isMovingUp =
              subsequentCollectionInTx.orderIndex < collectionInTx.orderIndex;

            // Calculate the range of siblings that need to shift
            const updateFrom = isMovingUp
              ? subsequentCollectionInTx.orderIndex
              : collectionInTx.orderIndex + 1;

            const updateTo = isMovingUp
              ? collectionInTx.orderIndex - 1
              : subsequentCollectionInTx.orderIndex - 1;

            // Shift the affected range: increment if moving up, decrement if down
            await tx.teamCollection.updateMany({
              where: {
                teamID: collection.right.teamID,
                parentID: collection.right.parentID,
                orderIndex: { gte: updateFrom, lte: updateTo },
              },
              data: {
                orderIndex: isMovingUp ? { increment: 1 } : { decrement: 1 },
              },
            });

            // Place the collection at its new position.
            // "Next collection" semantics: "place me just before this collection"
            // If moving up: take nextCollection's original position (it shifted right)
            // If moving down: take nextCollection's position - 1 (it shifted left)
            await tx.teamCollection.update({
              where: { id: collection.right.id },
              data: {
                orderIndex: isMovingUp
                  ? subsequentCollectionInTx.orderIndex
                  : subsequentCollectionInTx.orderIndex - 1,
              },
            });
          }
        } catch (error) {
          throw new ConflictException(error);
        }
      });

      // PATTERN: PubSub AFTER COMMIT — payload includes both collections
      this.pubsub.publish(
        `team_coll/${collection.right.teamID}/coll_order_updated`,
        {
          collection: this.cast(collection.right),
          nextCollection: this.cast(subsequentCollection.right),
        },
      );

      return E.right(true);
    } catch (error) {
      return E.left(TEAM_COL_REORDERING_FAILED);
    }
  }

  /**
   * Count total collections in a team (across all nesting levels).
   */
  async totalCollectionsInTeam(teamID: string) {
    const collCount = await this.prisma.teamCollection.count({
      where: {
        teamID: teamID,
      },
    });

    return collCount;
  }

  /**
   * Count all team collections across all teams in the database.
   */
  async getTeamCollectionsCount() {
    const teamCollectionsCount = this.prisma.teamCollection.count();
    return teamCollectionsCount;
  }

  /**
   * Update collection title and/or data.
   *
   * NOTE: No locking needed because title/data changes don't affect orderIndex.
   * Only orderIndex-mutating operations require pessimistic locking.
   *
   * CONSTRAINT: Data field validation — same rules as createCollection.
   * PATTERN: PubSub AFTER update — coll_updated with full TeamCollection.
   */
  async updateTeamCollection(
    collectionID: string,
    collectionData: string = null,
    newTitle: string = null,
  ) {
    try {
      if (newTitle != null) {
        const isTitleValid = isValidLength(newTitle, this.TITLE_LENGTH);
        if (!isTitleValid) return E.left(TEAM_COLL_SHORT_TITLE);
      }

      // CONSTRAINT: Data field — empty string explicitly rejected
      if (collectionData === '') return E.left(TEAM_COLL_DATA_INVALID);
      if (collectionData) {
        const jsonReq = stringToJson(collectionData);
        if (E.isLeft(jsonReq)) return E.left(TEAM_COLL_DATA_INVALID);
        collectionData = jsonReq.right;
      }

      const updatedTeamCollection = await this.prisma.teamCollection.update({
        where: { id: collectionID },
        data: {
          data: collectionData ?? undefined,
          title: newTitle ?? undefined,
        },
      });

      this.pubsub.publish(
        `team_coll/${updatedTeamCollection.teamID}/coll_updated`,
        this.cast(updatedTeamCollection),
      );

      return E.right(this.cast(updatedTeamCollection));
    } catch (e) {
      return E.left(TEAM_COLL_NOT_FOUND);
    }
  }

  /**
   * Search for collections and requests by title.
   *
   * DECISION: Raw SQL (not Prisma query builder) because the search requires
   * PostgreSQL-specific features:
   *   - ILIKE for case-insensitive matching
   *   - similarity() function for fuzzy ranking
   *   - escapeSqlLikeString for safe wildcard injection
   * Prisma's query builder doesn't expose similarity() or custom ordering
   * by a function result.
   *
   * DECISION: Recursive CTE for parent tree reconstruction. After finding
   * matches, the UI needs breadcrumb paths (e.g., "Parent > Child > Match").
   * A single WITH RECURSIVE CTE fetches the entire ancestor chain in one query,
   * which is critical for performance when search returns many results.
   */
  async searchByTitle(
    searchQuery: string,
    teamID: string,
    take = 10,
    skip = 0,
  ) {
    const searchResults: SearchQueryReturnType[] = [];

    const matchedCollections = await this.searchCollections(
      searchQuery,
      teamID,
      take,
      skip,
    );
    if (E.isLeft(matchedCollections))
      return E.left(<RESTError>{
        message: matchedCollections.left,
        statusCode: HttpStatus.NOT_FOUND,
      });
    searchResults.push(...matchedCollections.right);

    const matchedRequests = await this.searchRequests(
      searchQuery,
      teamID,
      take,
      skip,
    );
    if (E.isLeft(matchedRequests))
      return E.left(<RESTError>{
        message: matchedRequests.left,
        statusCode: HttpStatus.NOT_FOUND,
      });
    searchResults.push(...matchedRequests.right);

    // Generate breadcrumb paths for each result using recursive CTE
    const searchResultsWithTree: CollectionSearchNode[] = [];

    for (let i = 0; i < searchResults.length; i++) {
      const fetchedParentTree = await this.fetchParentTree(searchResults[i]);
      if (E.isLeft(fetchedParentTree))
        return E.left(<RESTError>{
          message: fetchedParentTree.left,
          statusCode: HttpStatus.NOT_FOUND,
        });
      searchResultsWithTree.push({
        type: searchResults[i].type,
        title: searchResults[i].title,
        method: searchResults[i].method,
        id: searchResults[i].id,
        path: !fetchedParentTree
          ? []
          : (fetchedParentTree.right as CollectionSearchNode[]),
      });
    }

    return E.right({ data: searchResultsWithTree });
  }

  /**
   * Search collections by title using raw SQL.
   * Uses ILIKE for case-insensitive matching and similarity() for fuzzy ranking.
   */
  private async searchCollections(
    searchQuery: string,
    teamID: string,
    take: number,
    skip: number,
  ) {
    const query = Prisma.sql`
    SELECT
      id,title,'collection' AS type
    FROM
      "TeamCollection"
    WHERE
      "TeamCollection"."teamID"=${teamID}
      AND
        title ILIKE ${`%${escapeSqlLikeString(searchQuery)}%`}
    ORDER BY
      similarity(title, ${searchQuery})
    LIMIT ${take}
    OFFSET ${skip === 0 ? 0 : (skip - 1) * take};
  `;

    try {
      const res = await this.prisma.$queryRaw<SearchQueryReturnType[]>(query);
      return E.right(res);
    } catch (error) {
      return E.left(TEAM_COL_SEARCH_FAILED);
    }
  }

  /**
   * Search requests by title using raw SQL.
   * Also extracts the HTTP method from the request JSON for display.
   */
  private async searchRequests(
    searchQuery: string,
    teamID: string,
    take: number,
    skip: number,
  ) {
    const query = Prisma.sql`
    SELECT
      id,title,request->>'method' as method,'request' AS type
    FROM
      "TeamRequest"
    WHERE
      "TeamRequest"."teamID"=${teamID}
      AND
        title ILIKE ${`%${escapeSqlLikeString(searchQuery)}%`}
    ORDER BY
      similarity(title, ${searchQuery})
    LIMIT ${take}
    OFFSET ${skip === 0 ? 0 : (skip - 1) * take};
  `;

    try {
      const res = await this.prisma.$queryRaw<SearchQueryReturnType[]>(query);
      return E.right(res);
    } catch (error) {
      return E.left(TEAM_REQ_SEARCH_FAILED);
    }
  }

  /**
   * Route to collection or request parent tree fetch based on result type.
   */
  private async fetchParentTree(searchResult: SearchQueryReturnType) {
    return searchResult.type === 'collection'
      ? await this.fetchCollectionParentTree(searchResult.id)
      : await this.fetchRequestParentTree(searchResult.id);
  }

  /**
   * Fetch the parent tree (breadcrumb path) for a collection.
   *
   * DECISION: Uses a recursive CTE (WITH RECURSIVE) to walk up the tree
   * from the collection to the root in a single query, rather than making
   * N queries (one per ancestor level). This is critical for search performance
   * when many results need parent trees.
   */
  private async fetchCollectionParentTree(id: string) {
    try {
      const query = Prisma.sql`
      WITH RECURSIVE collection_tree AS (
        SELECT tc.id, tc."parentID", tc.title
        FROM "TeamCollection" AS tc
        JOIN "TeamCollection" AS tr ON tc.id = tr."parentID"
        WHERE tr.id = ${id}

        UNION ALL

        SELECT parent.id,  parent."parentID", parent.title
        FROM "TeamCollection" AS parent
        JOIN collection_tree AS ct ON parent.id = ct."parentID"
      )
      SELECT * FROM collection_tree;
      `;
      const res =
        await this.prisma.$queryRaw<ParentTreeQueryReturnType[]>(query);

      const collectionParentTree = this.generateParentTree(res);
      return E.right(collectionParentTree);
    } catch (error) {
      E.left(TEAM_COLL_PARENT_TREE_GEN_FAILED);
    }
  }

  /**
   * Build a nested CollectionSearchNode tree from flat parent collection rows.
   * Recursively nests children under their parents to create the breadcrumb path.
   */
  private generateParentTree(parentCollections: ParentTreeQueryReturnType[]) {
    function findChildren(id: string): CollectionSearchNode[] {
      const collection = parentCollections.filter((item) => item.id === id)[0];
      if (collection.parentID == null) {
        return <CollectionSearchNode[]>[
          {
            id: collection.id,
            title: collection.title,
            type: 'collection' as const,
            path: [],
          },
        ];
      }

      const res = <CollectionSearchNode[]>[
        {
          id: collection.id,
          title: collection.title,
          type: 'collection' as const,
          path: findChildren(collection.parentID),
        },
      ];
      return res;
    }

    if (parentCollections.length > 0) {
      if (parentCollections[0].parentID == null) {
        return <CollectionSearchNode[]>[
          {
            id: parentCollections[0].id,
            title: parentCollections[0].title,
            type: 'collection',
            path: [],
          },
        ];
      }

      return <CollectionSearchNode[]>[
        {
          id: parentCollections[0].id,
          title: parentCollections[0].title,
          type: 'collection',
          path: findChildren(parentCollections[0].parentID),
        },
      ];
    }

    return <CollectionSearchNode[]>[];
  }

  /**
   * Fetch the parent tree (breadcrumb path) for a request.
   * Same recursive CTE approach as fetchCollectionParentTree, but starts
   * from a TeamRequest's collectionID instead of a TeamCollection's parentID.
   */
  private async fetchRequestParentTree(id: string) {
    try {
      const query = Prisma.sql`
      WITH RECURSIVE request_collection_tree AS (
        SELECT tc.id, tc."parentID", tc.title
        FROM "TeamCollection" AS tc
        JOIN "TeamRequest" AS tr ON tc.id = tr."collectionID"
        WHERE tr.id = ${id}

        UNION ALL

        SELECT parent.id, parent."parentID", parent.title
        FROM "TeamCollection" AS parent
        JOIN request_collection_tree AS ct ON parent.id = ct."parentID"
      )
      SELECT * FROM request_collection_tree;

      `;
      const res =
        await this.prisma.$queryRaw<ParentTreeQueryReturnType[]>(query);

      const requestParentTree = this.generateParentTree(res);
      return E.right(requestParentTree);
    } catch (error) {
      return E.left(TEAM_REQ_PARENT_TREE_GEN_FAILED);
    }
  }

  /**
   * Get all requests in a collection, ordered by orderIndex.
   */
  private async getAllRequestsInCollection(collectionID: string) {
    const dbTeamRequests = await this.prisma.teamRequest.findMany({
      where: {
        collectionID: collectionID,
      },
      orderBy: {
        orderIndex: 'asc',
      },
    });

    const teamRequests = dbTeamRequests.map((tr) => {
      return <TeamRequest>{
        id: tr.id,
        collectionID: tr.collectionID,
        teamID: tr.teamID,
        title: tr.title,
        request: JSON.stringify(tr.request),
      };
    });

    return teamRequests;
  }

  /**
   * Recursively build the collection tree for CLI output.
   * Includes all nested children and requests at each level.
   */
  private async getCollectionTreeForCLI(parentID: string | null) {
    const childCollections = await this.prisma.teamCollection.findMany({
      where: { parentID },
      orderBy: { orderIndex: 'asc' },
    });

    const response: GetCollectionResponse[] = [];

    for (const collection of childCollections) {
      const folder: GetCollectionResponse = {
        id: collection.id,
        data: collection.data === null ? null : JSON.stringify(collection.data),
        title: collection.title,
        parentID: collection.parentID,
        folders: await this.getCollectionTreeForCLI(collection.id),
        requests: await this.getAllRequestsInCollection(collection.id),
      };

      response.push(folder);
    }

    return response;
  }

  /**
   * Get a specific collection for CLI, including full tree and requests.
   * Verifies team membership before returning data.
   */
  async getCollectionForCLI(collectionID: string, userUid: string) {
    try {
      const collection = await this.prisma.teamCollection.findUniqueOrThrow({
        where: { id: collectionID },
      });

      const teamMember = await this.teamService.getTeamMember(
        collection.teamID,
        userUid,
      );
      if (!teamMember) return E.left(TEAM_MEMBER_NOT_FOUND);

      return E.right(<GetCollectionResponse>{
        id: collection.id,
        data: collection.data === null ? null : JSON.stringify(collection.data),
        title: collection.title,
        parentID: collection.parentID,
        folders: await this.getCollectionTreeForCLI(collection.id),
        requests: await this.getAllRequestsInCollection(collection.id),
      });
    } catch (error) {
      return E.left(TEAM_COLL_NOT_FOUND);
    }
  }

  /**
   * Duplicate a team collection and all its descendants.
   *
   * DECISION: EXPORT+IMPORT PIPELINE (ADR-003)
   * Rather than implementing a separate deep-copy method, duplication:
   *   1. Exports the collection to JSON (exportCollectionToJSONObject)
   *   2. Modifies the title (appends " - Duplicate")
   *   3. Re-imports via importCollectionsFromJSON
   *
   * This reuses the existing recursive import logic (which handles nested
   * children, requests, locking, and orderIndex assignment) without
   * duplicating any code. The trade-off is a serialization round-trip, but
   * it eliminates a separate code path that would need to maintain parity
   * with import logic.
   *
   * The duplicate is placed in the SAME parent as the original, at the end
   * of the sibling set (import always appends).
   */
  async duplicateTeamCollection(collectionID: string) {
    const collection = await this.getCollection(collectionID);
    if (E.isLeft(collection)) return E.left(TEAM_INVALID_COLL_ID);

    // Step 1: Export — serialize the entire subtree to JSON
    const collectionJSONObject = await this.exportCollectionToJSONObject(
      collection.right.teamID,
      collectionID,
    );
    if (E.isLeft(collectionJSONObject)) return E.left(TEAM_INVALID_COLL_ID);

    // Step 2+3: Modify title and re-import — creates new IDs, correct orderIndexes
    const result = await this.importCollectionsFromJSON(
      JSON.stringify([
        {
          ...collectionJSONObject.right,
          name: `${collection.right.title} - Duplicate`,
        },
      ]),
      collection.right.teamID,
      collection.right.parentID,
    );
    if (E.isLeft(result)) return E.left(result.left as string);

    return E.right(true);
  }

  /**
   * Sort all sibling collections under a parent by title (ascending or descending).
   *
   * PATTERN: PESSIMISTIC LOCKING — acquires lock before reading and reassigning.
   * After sorting, orderIndex values are reassigned as contiguous 1..N based on
   * the sorted order, maintaining the contiguity invariant.
   *
   * NOTE: No PubSub event is emitted for sort. This may be a gap — connected
   * clients won't see the reorder in real-time unless they refresh.
   */
  async sortTeamCollections(
    teamID: string,
    parentID: string,
    sortBy: SortOptions,
  ) {
    // Handle all sort options, including a default
    let orderBy: Prisma.Enumerable<Prisma.TeamCollectionOrderByWithRelationInput>;
    if (sortBy === SortOptions.TITLE_ASC) {
      orderBy = { title: 'asc' };
    } else if (sortBy === SortOptions.TITLE_DESC) {
      orderBy = { title: 'desc' };
    } else {
      orderBy = { orderIndex: 'asc' };
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        // PATTERN: PESSIMISTIC LOCKING
        await this.prisma.lockTeamCollectionByTeamAndParent(
          tx,
          teamID,
          parentID,
        );

        const collections = await tx.teamCollection.findMany({
          where: { teamID, parentID },
          orderBy,
          select: { id: true },
        });

        // INVARIANT: Reassign contiguous 1..N orderIndex based on sorted order
        const promises = collections.map((collection, i) =>
          tx.teamCollection.update({
            where: { id: collection.id },
            data: { orderIndex: i + 1 },
          }),
        );
        await Promise.all(promises);
      });
    } catch (error) {
      console.error(
        'Error from TeamCollectionService.sortTeamCollections',
        error,
      );
      return E.left(TEAM_COL_REORDERING_FAILED);
    }

    return E.right(true);
  }
}
