# Q5: PubSub Failure Impact Analysis

**Answering from:** `team-collections/team-collection-service` context package only (TeamCollectionService node).

---

## 1. Which operations publish PubSub events

The PubSub Events aspect explicitly lists every mutation that publishes:

| Channel | Trigger Operation(s) |
|---|---|
| `team_coll/${teamID}/coll_added` | `createCollection`, `importCollectionsFromJSON` |
| `team_coll/${teamID}/coll_updated` | `renameCollection`, `updateCollectionData` |
| `team_coll/${teamID}/coll_removed` | `deleteCollection` |
| `team_coll/${teamID}/coll_moved` | `moveCollection` |
| `team_coll/${teamID}/coll_order_updated` | `updateCollectionOrder` |

Additionally, `duplicateCollection` (which is export + reimport) would trigger `coll_added` events via the import path. `sortCollection` would trigger `coll_order_updated` events.

**Read-only queries do NOT publish events:** `getCollection`, `getChildCollections`, `searchByTitle`, `getCollectionForCLI`, `getCollectionTreeForCLI`, `totalCollectionsInTeam`, `getTeamCollectionsCount`, and `exportCollectionsToJSON`.

The dependency on TeamService also shows that TeamService publishes its own PubSub events (`member_added`, `member_updated`, `member_removed`), so team membership mutations are also affected by PubSub outages -- but those are outside this node's direct control.

---

## 2. Whether PubSub publish is inside or after the database transaction

The PubSub Events aspect is explicit on this point:

> "Events are published **AFTER the database transaction commits successfully**. This prevents phantom events where the client sees an update but the transaction rolled back."

There is a specific note for the delete operation:

> "The exception is `deleteCollectionAndUpdateSiblingsOrderIndex` where the PubSub call happens after the retry loop succeeds."

This means the PubSub publish call is **outside** the database transaction in all cases. The pattern is:

1. Database transaction (with pessimistic locking) executes and commits
2. PubSub event is published after commit

---

## 3. Would a PubSub failure cause the operation to fail or just lose the notification?

**This is the critical question, and the context package does not provide a definitive answer.** Here is what can be inferred:

**Evidence suggesting operations would FAIL completely if PubSub is down:**

- The context does not mention any try/catch or error handling around PubSub publish calls.
- The context does not describe PubSub publishing as "fire-and-forget" or "best-effort."
- NestJS services typically propagate unhandled exceptions, which would cause the GraphQL resolver to return an error to the client.
- The fp-ts `Either` return types from mutations suggest errors are captured -- but PubSub errors (being infrastructure, not business errors) would likely throw rather than return `Left`.

**Evidence suggesting operations would DEGRADE gracefully:**

- PubSub infrastructure is explicitly listed as **out of scope** for TeamCollectionService ("delegated to PubSubService"), which suggests the PubSub service itself may have resilience logic.
- The fact that PubSub is called AFTER the transaction commits means the database write has already succeeded. If PubSub throws, the data is already persisted.
- The responsibility description frames PubSub as "real-time event publishing" -- a notification concern, not a data integrity concern.

**Most likely behavior based on the architecture:** The database mutation succeeds (data is persisted), then the PubSub publish call either (a) throws an unhandled exception that propagates to the caller, making the operation appear to fail despite the data being committed, or (b) is wrapped in error handling by the PubSubService. **Without seeing the PubSubService implementation or its error handling, this cannot be determined from this context package alone.**

---

## 4. User-visible symptoms

### If PubSub failure causes exceptions (operations fail):

- **Create collection:** User sees an error, but the collection IS created in the database. Refreshing the page would show the new collection. Other team members see nothing until they refresh.
- **Rename/update:** Error returned to the user, but the rename IS persisted. A page refresh reveals the change.
- **Delete:** Error returned, but the collection IS deleted and sibling orderIndexes ARE reindexed. Refreshing shows the deletion.
- **Move/reorder:** Error returned, but the move/reorder IS committed. Refreshing shows the new position.
- **Import:** Error returned, but imported collections ARE in the database. Refreshing shows them.
- **Duplicate:** Error returned after successful duplication in DB.

In all cases, the user sees an error message despite the mutation succeeding. This is a **phantom failure** -- the opposite of the phantom event problem the architecture was designed to prevent.

### If PubSub failure is silently handled:

- The mutating user sees **no error** -- their operation succeeds normally.
- **Other team members** connected via GraphQL subscriptions see **no real-time updates**. Their views become stale.
- Collections appear to "not update" for collaborators until they manually refresh.
- Drag-and-drop reordering by one user would not be reflected on another user's screen.
- Deleted collections would remain visible to other users until refresh.
- Newly created or imported collections would be invisible to collaborators until refresh.

### Read-only operations are completely unaffected:

- `getCollection`, `searchByTitle`, `getChildCollections`, `exportCollectionsToJSON`, all CLI queries, and count queries work normally regardless of PubSub status.

---

## 5. Data loss risk vs notification loss

### Data loss risk: NONE (for team collections)

The architecture explicitly separates data persistence from notification:

- All mutations use Prisma database transactions with pessimistic row locking.
- The database transaction commits BEFORE PubSub is called.
- Even if PubSub is completely down, every create, update, delete, move, reorder, import, and duplicate operation has its data fully committed to the database.
- The retry-on-deadlock mechanism for deletes is entirely database-level and independent of PubSub.
- OrderIndex integrity is maintained by the database transaction, not by PubSub.

### Notification loss risk: HIGH

Every mutation event would be lost during PubSub downtime:

- `coll_added` events: collaborators won't see new collections appear in real-time
- `coll_updated` events: title/data changes won't propagate to other users
- `coll_removed` events: deleted collections remain visible to others
- `coll_moved` events: moved collections appear in old location for others
- `coll_order_updated` events: reordering is invisible to collaborators

**These notifications are not queued or retried** (no evidence of outbox pattern, event sourcing, or guaranteed delivery in the context). Once the PubSub publish fails or is skipped, the event is permanently lost. Clients must refresh to resynchronize.

### Indirect risk: Inconsistent UI state across team members

While no data is lost, the lack of real-time updates creates a **consistency gap** between what different team members see. This can lead to:

- Two users editing the same collection simultaneously without knowing the other is making changes
- A user trying to access a collection that was already deleted by a teammate
- Confusion about collection ordering when drag-and-drop changes aren't propagated

### Summary table

| Concern | Risk Level | Detail |
|---|---|---|
| Database data loss | **None** | Transactions commit before PubSub |
| OrderIndex corruption | **None** | Pessimistic locking is DB-only |
| Real-time notification loss | **High** | No retry/queue for PubSub events |
| Cross-user consistency | **High** | Stale views until manual refresh |
| Single-user experience | **Low to Medium** | Depends on whether PubSub errors propagate (phantom failures) or are swallowed |
| Operation availability | **Unknown from this context** | Depends on PubSubService error handling |

---

## Limitations of this analysis

This analysis is based solely on the TeamCollectionService context package. Key unknowns that would require other context packages to resolve:

1. **PubSubService error handling**: Does it swallow errors, retry, or propagate exceptions? This determines whether mutations appear to fail.
2. **Client reconnection behavior**: Do GraphQL subscription clients auto-refresh on reconnect, or do they require manual refresh to resync?
3. **Other services' PubSub usage**: TeamService also publishes events (member_added/updated/removed). The same analysis would apply to those, but the specifics are outside this node's scope.
4. **PubSub implementation**: Is this Redis PubSub, an in-memory event bus, or something else? The failure modes differ significantly by implementation.
