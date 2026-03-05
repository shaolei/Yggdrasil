# Experiment 4.4: Hierarchy Value -- Results

## 1. Ground Truth (from source code analysis)

### Q1: What is the domain scope of the team-collections area?

The team-collections area manages the hierarchical collection tree for teams in Hoppscotch. Its domain scope covers:

- **Collection CRUD**: create, rename, update (title/data), delete with sibling reindexing
- **Tree operations**: move between parents (including root), reorder siblings, sort siblings alphabetically
- **Tree integrity**: circular reference prevention via recursive ancestor check, orderIndex contiguity enforcement
- **Import/export**: recursive JSON serialization/deserialization of entire collection subtrees (including nested requests)
- **Search**: raw SQL with ILIKE + similarity() fuzzy matching, with recursive CTE for breadcrumb parent-tree reconstruction (searches both collections and requests)
- **Duplication**: export-then-reimport with title modification (" - Duplicate")
- **CLI support**: getCollectionForCLI and getCollectionTreeForCLI with team membership verification
- **Real-time events**: PubSub publishing after every mutation (added, updated, removed, moved, order_updated)

The module also includes a GraphQL resolver (TeamCollectionResolver), a REST controller (TeamCollectionController), and a guard (GqlCollectionTeamMemberGuard). It imports TeamModule and UserModule.

### Q2: What responsibilities does the collection service NOT have?

From the source code:

- **Authentication/authorization**: handled by guards (GqlAuthGuard, GqlThrottlerGuard, GqlTeamMemberGuard, GqlCollectionTeamMemberGuard) and the resolver's role decorators -- the service never checks user permissions directly
- **Individual request CRUD within collections**: separate TeamRequest service handles that
- **Team membership management**: delegated to TeamService (the service only calls `getTeamMember` for CLI membership checks)
- **PubSub infrastructure**: delegated to PubSubService; the service only calls `publish()`
- **Team management** (create/delete/rename teams): delegated to TeamService

### Q3: How does the collection domain relate to the team domain?

From the source code:

- **Ownership**: Every collection has a `teamID` foreign key. Collections belong to exactly one team. There is no cross-team sharing.
- **Module dependency**: TeamCollectionModule imports TeamModule. The service injects TeamService.
- **Runtime calls**: TeamCollectionService calls `TeamService.getTeamMember(teamID, userUid)` in the CLI access methods to verify that the requesting user is a member of the collection's team.
- **Team scoping on mutations**: createCollection validates parentID belongs to the same team via `isOwnerCheck`. moveCollection validates source and destination belong to the same team. All queries filter by teamID.
- **Move constraint**: Cross-team moves are forbidden (`TEAM_COLL_NOT_SAME_TEAM`).

### Q4: What would happen if we added "collection sharing between teams" -- which module handles it?

From the source code:

- The team-collections module currently enforces strict single-team ownership. The `moveCollection` method explicitly rejects cross-team moves with `TEAM_COLL_NOT_SAME_TEAM`. The `isOwnerCheck` on creation verifies the parent belongs to the same team. The team-ownership aspect enforces that collections carry a `teamID` FK and there is no cross-team sharing.
- This feature would be a cross-cutting concern spanning the team-collections module (to relax its same-team constraints), the team module (to define sharing relationships), and potentially auth guards (to permit cross-team access).
- The team-collections module would be the primary implementation location since it owns collection data and enforces team-scoping, but it would need changes coordinated with the team module for the sharing relationship model.

### Q5: How does createTeamCollection assign orderIndex?

From source code (line 452-517):

1. Validates title length (>= 1 char)
2. If parentID is not null, validates parent belongs to the same team via `isOwnerCheck`
3. Validates data field (if provided, must be valid JSON; empty string explicitly rejected)
4. Opens a `prisma.$transaction`
5. Locks siblings: `lockTeamCollectionByTeamAndParent(tx, teamID, parentID)`
6. Finds the last collection under the same parent: `findFirst({ where: { teamID, parentID }, orderBy: { orderIndex: 'desc' } })`
7. Creates collection with `orderIndex: lastCollection ? lastCollection.orderIndex + 1 : 1`
8. After transaction commits, publishes `team_coll/${teamID}/coll_added` event

Key detail: If no siblings exist (lastCollection is null), orderIndex starts at 1 (not 0).

### Q6: What are the failure modes of moveCollection?

From source code (line 746-836):

1. **TEAM_COLL_NOT_FOUND** (via getCollection) -- source collection does not exist
2. **TEAM_COL_ALREADY_ROOT** -- source collection is already a root collection (parentID null) and destination is null (move to root)
3. **TEAM_COLL_DEST_SAME** -- source and destination are the same collection ID
4. **TEAM_COLL_NOT_FOUND** -- destination collection does not exist
5. **TEAM_COLL_NOT_SAME_TEAM** -- source and destination belong to different teams
6. **TEAM_COLL_IS_PARENT_COLL** -- source is an ancestor of destination (would create circular reference); detected by `isParent` returning None
7. **TEAM_COL_REORDERING_FAILED** -- transaction-level error (catch block on the outer $transaction)

The move operation locks rows for both source parent's siblings and destination parent's siblings within a single transaction.

### Q7: How does the search use fuzzy matching?

From source code (lines 1102-1235):

1. `searchByTitle` dispatches to two private methods: `searchCollections` and `searchRequests`
2. Both use raw SQL (Prisma.$queryRaw) with:
   - **ILIKE filter**: `title ILIKE '%<escaped_query>%'` for case-insensitive substring matching. The search term is escaped via `escapeSqlLikeString()` to prevent wildcard injection.
   - **similarity() ordering**: `ORDER BY similarity(title, <searchQuery>)` -- PostgreSQL's `pg_trgm` trigram similarity function, used to rank results by fuzzy relevance
3. Pagination: `LIMIT ${take} OFFSET ${skip === 0 ? 0 : (skip - 1) * take}`
4. After fetching matches, `fetchParentTree` is called per result, which uses a `WITH RECURSIVE` CTE to reconstruct the ancestor chain (breadcrumb path) from each result up to the root collection
5. Search results include both collections (type: 'collection') and requests (type: 'request', including HTTP method)

### Q8: What concurrency mechanism protects reorder operations?

From source code:

1. **Pessimistic row locking**: `prisma.lockTeamCollectionByTeamAndParent(tx, teamID, parentID)` is called inside every `$transaction` that modifies orderIndex. This locks all sibling rows under a given parent, serializing concurrent access.
2. **Lock scope**: `(teamID, parentID)` -- only siblings under the same parent are locked, allowing parallel operations on different subtrees.
3. **Race condition guard**: `updateCollectionOrder` re-reads the collection's orderIndex INSIDE the transaction (after acquiring the lock) rather than relying on the pre-transaction read. This prevents stale reads.
4. **Retry on deadlock** (delete only): `deleteCollectionAndUpdateSiblingsOrderIndex` has a retry loop (max 5 retries, linear backoff 100ms increments) that handles `UNIQUE_CONSTRAINT_VIOLATION`, `TRANSACTION_DEADLOCK`, and `TRANSACTION_TIMEOUT` Prisma error codes. Other mutations do NOT retry.

---

## 2. Context Package Details

| Metric | Condition A (Hierarchical) | Condition B (Flat-Equivalent) | Condition C (Child-Only) |
|---|---|---|---|
| Lines | 520 | 517 | 496 |
| Words | 3381 | 3380 | 3263 |
| Structure | global + hierarchy + own-artifacts + aspects + dependency | global + own-artifacts (with merged parent content) + aspects + dependency | global + own-artifacts + aspects + dependency |

### What differs between conditions

**A vs B**: Condition A has a `<hierarchy>` section containing the parent's responsibility.md (domain scope, in-scope/out-of-scope). Condition B removes the `<hierarchy>` section and instead includes the same content as a `### domain-context.md` artifact within `<own-artifacts>`. The information content is identical; only the structural framing differs (parent context labeled as hierarchy vs. merged local artifact).

**A vs C**: Condition C removes the `<hierarchy>` section entirely. The parent's domain-level scope description (what the area manages, what is in/out of scope at the module level) is absent. The child still has its own responsibility.md which partially overlaps but uses service-specific framing.

**B vs C**: Condition B has the parent's content merged in; Condition C does not. This isolates the pure content value of the parent information.

---

## 3. Answers Under Each Condition

### Condition A (Hierarchical)

**Q1 (Domain scope):** The hierarchy section explicitly states the domain: "Manages the hierarchical collection tree for teams in Hoppscotch." In scope: Collection CRUD, Tree operations (move, reorder, sort), Tree integrity (circular reference prevention, orderIndex consistency), Import/export (JSON serialization of subtrees), Search with parent tree reconstruction (breadcrumb paths), Duplication (export + re-import), Real-time event publishing. Out of scope: auth, request-level CRUD (separate TeamRequest service), team management (TeamService).

**Q2 (NOT responsible for):** From hierarchy out-of-scope: auth/authorization (guards/resolvers), request-level CRUD (TeamRequest service), team management (TeamService). From own responsibility out-of-scope: additionally PubSub infrastructure (PubSubService), individual request CRUD.

**Q3 (Relation to team domain):** The child has a `calls` relation to `team/team-service`, consuming `getTeamMember`. The team-ownership aspect describes that collections store a `teamID` FK, move operations verify same-team, and there is no cross-team sharing. The hierarchy section shows the parent module maps the `team-collection/` directory. The dependency section shows TeamService manages team lifecycle separately.

**Q4 (Collection sharing):** The team-ownership aspect explicitly states: "There is no cross-team sharing. Moving resources between teams is not supported." The hierarchy out-of-scope says team management is delegated. The constraints show `TEAM_COLL_NOT_SAME_TEAM`. This would require changes spanning team-collections (relax same-team constraints), team module (sharing relationship model), and likely new cross-cutting aspects. The team-collections module would be the primary location since it owns collection data.

**Q5 (createTeamCollection orderIndex):** From interface.md: `createCollection` creates with ordering. From logic.md (via the context's own-artifacts): not explicitly detailed for create. From constraints: "Every create appends at `lastIndex + 1`." From the pessimistic-locking aspect: the transaction locks siblings, reads current state, creates. So: lock siblings, find last orderIndex, assign lastIndex + 1 (or 1 if none exist).

**Q6 (moveCollection failure modes):** From errors.md: TEAM_COLL_NOT_FOUND, TEAM_COLL_NOT_SAME_TEAM, TEAM_COLL_IS_PARENT_COLL (circular), TEAM_COLL_DEST_SAME (self-move), TEAM_COL_ALREADY_ROOT (root-to-root). From constraints: circular reference prevention, same-team constraint, self-move prevention, already-root guard. From logic.md: two-parent operation. Additionally TEAM_COL_REORDERING_FAILED from transaction errors.

**Q7 (Search fuzzy matching):** From responsibility.md: "raw SQL queries with ILIKE + similarity() fuzzy matching, plus recursive CTE for parent tree reconstruction." From decisions.md: "ILIKE for case-insensitive matching, similarity() function for fuzzy ranking, escapeSqlLikeString for safe wildcard injection. Prisma's query builder doesn't expose similarity()." Recursive CTE fetches ancestor chain for breadcrumbs.

**Q8 (Concurrency for reorder):** From pessimistic-locking aspect: open $transaction, call lockTeamCollectionByTeamAndParent(tx, teamID, parentID), read current state, perform mutations, transaction commits releasing locks. Lock scoped to (teamID, parentID). From retry-on-deadlock aspect: delete uses retry loop (max 5, linear backoff 100ms), handles UNIQUE_CONSTRAINT_VIOLATION, TRANSACTION_DEADLOCK, TRANSACTION_TIMEOUT. Other mutations do not retry. From logic.md: reorder re-reads orderIndex inside transaction.

### Condition B (Flat-Equivalent)

**Q1 (Domain scope):** The domain-context.md artifact (merged from parent) explicitly states: "Manages the hierarchical collection tree for teams in Hoppscotch." In scope: Collection CRUD, Tree operations, Tree integrity, Import/export, Search with parent tree reconstruction, Duplication, Real-time event publishing. Out of scope: auth, request-level CRUD, team management.

**Q2 (NOT responsible for):** From domain-context.md out-of-scope: auth/authorization, request-level CRUD (TeamRequest service), team management (TeamService). From own responsibility out-of-scope: additionally PubSub infrastructure, individual request CRUD.

**Q3 (Relation to team domain):** The child has a `calls` relation to `team/team-service`, consuming `getTeamMember`. The team-ownership aspect describes teamID FK, same-team enforcement. Domain-context.md says team management is delegated to TeamService.

**Q4 (Collection sharing):** The team-ownership aspect states: "no cross-team sharing." Domain-context out-of-scope: team management delegated. Constraints: TEAM_COLL_NOT_SAME_TEAM. Would require changes in team-collections (relax constraints), team module (sharing model), and potentially auth. Team-collections is primary location.

**Q5 (createTeamCollection orderIndex):** From constraints: "Every create appends at `lastIndex + 1`." From pessimistic-locking: lock siblings, read current state, create. So: lock siblings, find last orderIndex, assign lastIndex + 1 (or 1 if none).

**Q6 (moveCollection failure modes):** From errors.md: TEAM_COLL_NOT_FOUND, TEAM_COLL_NOT_SAME_TEAM, TEAM_COLL_IS_PARENT_COLL, TEAM_COLL_DEST_SAME, TEAM_COL_ALREADY_ROOT. From constraints: same details. From logic.md: two-parent operation. TEAM_COL_REORDERING_FAILED from transaction errors.

**Q7 (Search fuzzy matching):** From responsibility.md: "raw SQL with ILIKE + similarity() fuzzy matching, recursive CTE for parent tree reconstruction." From decisions.md: ILIKE for case-insensitive matching, similarity() for fuzzy ranking, escapeSqlLikeString, Prisma doesn't expose similarity(). CTE for breadcrumbs.

**Q8 (Concurrency for reorder):** From pessimistic-locking aspect: $transaction + lockTeamCollectionByTeamAndParent, scoped to (teamID, parentID). From retry-on-deadlock: delete retries max 5, linear backoff 100ms, handles specific Prisma errors. Other mutations no retry. From logic.md: re-reads inside transaction.

### Condition C (Child-Only)

**Q1 (Domain scope):** From own responsibility.md: "The central service for all team collection operations." In scope: Collection CRUD, Tree operations, Tree integrity, Import/export, Search, Duplication, CLI support. This describes the service's scope but lacks the module-level framing of what the broader area encompasses (e.g., the resolver, controller, guards are not mentioned as part of a larger domain).

**Q2 (NOT responsible for):** From own responsibility out-of-scope: auth/authorization, individual request CRUD, team membership management (TeamService), PubSub infrastructure (PubSubService). No module-level out-of-scope to cross-reference (lacks the parent's "Request-level CRUD (separate TeamRequest service)" and "Team management (delegated to TeamService)" stated at domain level).

**Q3 (Relation to team domain):** The child has a `calls` relation to `team/team-service`, consuming `getTeamMember`. The team-ownership aspect describes teamID FK and cross-team isolation. The dependency section shows TeamService responsibility. But there is no explicit statement about the collection domain being a sub-domain or how it sits relative to team management at the module level.

**Q4 (Collection sharing):** The team-ownership aspect states: "no cross-team sharing." Constraints: TEAM_COLL_NOT_SAME_TEAM. Can infer the team-collections service is the primary location. But without the module-level scope, it is harder to identify which OTHER modules would need to be involved. The dependency on TeamService is visible, but the broader module boundary is less clear.

**Q5 (createTeamCollection orderIndex):** From constraints: "Every create appends at `lastIndex + 1`." From pessimistic-locking: lock siblings, read current state, create. So: lock siblings, find last orderIndex, assign lastIndex + 1 (or 1 if none).

**Q6 (moveCollection failure modes):** From errors.md: same list (TEAM_COLL_NOT_FOUND, TEAM_COLL_NOT_SAME_TEAM, TEAM_COLL_IS_PARENT_COLL, TEAM_COLL_DEST_SAME, TEAM_COL_ALREADY_ROOT, TEAM_COL_REORDERING_FAILED). From constraints and logic.md: same details.

**Q7 (Search fuzzy matching):** From responsibility.md: "raw SQL with ILIKE + similarity() fuzzy matching, recursive CTE for parent tree reconstruction." From decisions.md: same details about ILIKE, similarity(), escapeSqlLikeString, Prisma limitation. CTE for breadcrumbs.

**Q8 (Concurrency for reorder):** From pessimistic-locking aspect: identical. From retry-on-deadlock: identical. From logic.md: identical.

---

## 4. Score Matrix

Scoring: 0 = completely wrong, 1 = mostly wrong with a minor correct element, 2 = partially correct but major gaps, 3 = correct in key points but missing important details, 4 = mostly correct with minor gaps, 5 = fully correct matching ground truth.

| # | Question | Category | Cond A (Hierarchical) | Cond B (Flat-Equiv) | Cond C (Child-Only) |
|---|---|---|---|---|---|
| 1 | Domain scope of team-collections area | Boundary | 5 | 5 | 3 |
| 2 | Responsibilities NOT held by service | Boundary | 5 | 5 | 4 |
| 3 | Relation to team domain | Boundary | 5 | 4 | 3 |
| 4 | Collection sharing -- which module? | Boundary | 5 | 5 | 3 |
| 5 | createTeamCollection orderIndex | Implementation | 4 | 4 | 4 |
| 6 | moveCollection failure modes | Implementation | 5 | 5 | 5 |
| 7 | Search fuzzy matching | Implementation | 4 | 4 | 4 |
| 8 | Concurrency for reorder | Implementation | 5 | 5 | 5 |

### Scoring rationale

**Q1 -- Domain scope:**
- **A (5):** The hierarchy section provides explicit module-level domain scope including all 7 in-scope areas. The own-artifacts confirm service-level detail. Complete.
- **B (5):** The merged domain-context.md provides exactly the same information. Equally complete.
- **C (3):** The service's own responsibility.md covers what the service does, but misses the module-level framing. Cannot identify the resolver, controller, guard as part of the broader domain. The answer is service-scoped, not area-scoped, which is what the question asks.

**Q2 -- NOT responsible for:**
- **A (5):** Two-layer answer: parent out-of-scope (auth, request CRUD, team management) + service out-of-scope (adds PubSub infrastructure). Complete.
- **B (5):** Same two sources merged into flat structure. Equally complete.
- **C (4):** Service out-of-scope covers auth, request CRUD, team membership, PubSub. Missing the explicit module-level delegation framing ("separate TeamRequest service" vs just "individual request CRUD"), but the key boundaries are stated. Minor gap.

**Q3 -- Relation to team domain:**
- **A (5):** Hierarchy shows collection domain nests under team-scoped module. Calls relation to TeamService. Team-ownership aspect. Dependency details. Module import relationship is implicit from the hierarchy structure. Complete.
- **B (4):** Same content but presented flat. The relationship is described through aspects and dependency, but the structural nesting signal (collections as a sub-domain of team functionality) is lost. The flat domain-context.md says "delegated to TeamService" but doesn't frame the architectural relationship as clearly. Slightly weaker on the architectural framing.
- **C (3):** Calls relation to TeamService is visible. Team-ownership aspect mentions collections store teamID. But the broader domain relationship -- that collections are a sub-domain within the team ecosystem -- must be inferred. The module-level context about what else lives alongside the service is absent.

**Q4 -- Collection sharing:**
- **A (5):** Team-ownership aspect + hierarchy out-of-scope + constraints combine to give a complete picture: no cross-team sharing, would need changes in collections (relax constraints), team (sharing model), and auth. The hierarchy makes the module boundary explicit, making it clear which modules are involved.
- **B (5):** Domain-context.md + team-ownership aspect + constraints provide equivalent information. The merged content is sufficient for the same quality answer.
- **C (3):** Team-ownership aspect says no cross-team sharing. Constraints confirm. But without the module-level scope, identifying the full blast radius (which other modules? what is the module boundary?) is harder. The answer can identify the service-level constraints but struggles to frame the cross-module coordination needed.

**Q5 -- createTeamCollection orderIndex:**
- **A (4):** Constraints say "appends at lastIndex + 1." Pessimistic locking describes the transaction pattern. Missing the specific detail that orderIndex starts at 1 (not 0) when no siblings exist -- this detail is in code but not explicitly in the context package. The context says "contiguous starting from 1" in the contiguity constraint, so this can be inferred.
- **B (4):** Same artifacts, same answer.
- **C (4):** Same artifacts, same answer. No parent content is relevant here.

**Q6 -- moveCollection failure modes:**
- **A (5):** errors.md + constraints.md + logic.md combine for complete coverage of all 7 failure modes.
- **B (5):** Same artifacts.
- **C (5):** Same artifacts. No parent content relevant.

**Q7 -- Search fuzzy matching:**
- **A (4):** Responsibility + decisions describe ILIKE, similarity(), escapeSqlLikeString, CTE. Missing details: the search covers both collections AND requests, pagination uses OFFSET, and the specific SQL structure. These details are in code but partially described in the context.
- **B (4):** Same artifacts.
- **C (4):** Same artifacts. No parent content relevant.

**Q8 -- Concurrency for reorder:**
- **A (5):** Pessimistic-locking aspect + retry-on-deadlock aspect + logic.md give comprehensive coverage: lock pattern, scope, retry strategy, which operations retry.
- **B (5):** Same aspects.
- **C (5):** Same aspects. No parent content relevant.

---

## 5. Summary Statistics

### Mean scores by condition

| Condition | Mean (all 8) | Mean (Boundary Q1-4) | Mean (Implementation Q5-8) |
|---|---|---|---|
| A (Hierarchical) | 4.75 | 5.00 | 4.50 |
| B (Flat-Equivalent) | 4.63 | 4.75 | 4.50 |
| C (Child-Only) | 3.88 | 3.25 | 4.50 |

### Delta analysis

| Comparison | All Questions | Boundary (Q1-4) | Implementation (Q5-8) |
|---|---|---|---|
| Delta A-B (hierarchy structural value) | +0.12 | +0.25 | 0.00 |
| Delta A-C (parent content value) | +0.87 | +1.75 | 0.00 |
| Delta B-C (content value without structure) | +0.75 | +1.50 | 0.00 |

---

## 6. Analysis

### Does hierarchy add value BEYOND the content it carries?

**Small but measurable: +0.25 on boundary questions.** The delta A-B isolates the structural signal of hierarchy (same content, different presentation). The effect is small -- 0.25 points on a 5-point scale on boundary questions, zero on implementation questions.

The structural signal manifests primarily on Q3 (relation to team domain), where the `<hierarchy>` section's explicit nesting communicates an architectural relationship (collections are a sub-domain within team functionality) that is harder to read from a flat "domain-context.md" artifact. In Condition B, the same information exists but reads as "here is some extra context" rather than "this service lives within this domain." The parent-child relationship between nodes mirrors the parent-child relationship in the actual architecture.

On Q1, Q2, and Q4, the structural signal did not produce a measurable difference because the merged content in Condition B was equally clear. The domain scope, exclusions, and cross-module blast radius analysis did not benefit from knowing the content came from a parent node vs. a local artifact.

### Which question types benefit from hierarchy?

**Boundary/responsibility questions benefit from parent content. Only architectural-relationship questions benefit from hierarchy structure specifically.**

The dominant effect is **parent content value** (Delta B-C = +1.50 on boundary questions), not hierarchy structure. The parent's responsibility.md provides module-level domain framing that the child's responsibility.md cannot replicate because the child describes itself, not the broader area it belongs to.

Specific question types:

- **Domain scope** (Q1): Parent content essential (+2 points C to A). Hierarchy structure irrelevant (A = B).
- **Negative boundaries** (Q2): Parent content helpful (+1 point C to A). Hierarchy structure irrelevant.
- **Domain relationships** (Q3): Both parent content (+1 point C to B) AND hierarchy structure (+1 point B to A) contribute. This is the only question where hierarchy structure alone adds value.
- **Cross-module blast radius** (Q4): Parent content essential (+2 points C to A). Hierarchy structure irrelevant (A = B).
- **Implementation details** (Q5-8): Neither parent content nor hierarchy structure relevant. All conditions score identically.

### Is hierarchy a convenience or a necessity?

**Hierarchy is a convenience, not a necessity -- with one exception.**

The data shows that 86% of the total improvement (A over C) comes from parent content (Delta B-C = 0.75) rather than hierarchy structure (Delta A-B = 0.12). A flat structure with merged parent information captures nearly all the value.

The exception is architectural-relationship questions (Q3-type), where the structural nesting provides a signal that flat merging does not: the parent-child node relationship mirrors and communicates the architectural parent-child relationship. This signal is small (1 point on 1 question) but real.

**However**, hierarchy provides important indirect value not captured in this scoring:

1. **Authoring efficiency**: Without hierarchy, the parent's domain context would need to be manually duplicated into every child. With hierarchy, it is authored once and inherited automatically. For a module with 3-5 children, this eliminates 3-5x content duplication.

2. **Consistency maintenance**: When the module-level scope changes, hierarchy updates it in one place. Flat structure would require updating every child's merged content -- a maintenance burden that grows with children.

3. **Context budget efficiency**: In the hierarchical package, the parent content appears once (~120 words). In a flat structure with multiple siblings, that content would either be duplicated per child (budget waste) or omitted from some children (information loss).

4. **Structural navigation**: When an agent needs to understand "what else lives in this area?", hierarchy provides that signal through sibling nodes. Flat structure makes sibling discovery harder.

---

## 7. Conclusions

### Primary finding

**Parent content provides 6x more value than hierarchy structure (Delta B-C = 1.50 vs Delta A-B = 0.25 on boundary questions).** The most important thing hierarchy does is carry parent content to children. The structural framing adds a small additional signal.

### Quantified results

- Hierarchy vs. child-only: +1.75 points on boundary questions (35% improvement)
- Flat-equivalent vs. child-only: +1.50 points on boundary questions (30% improvement)
- Hierarchy vs. flat-equivalent: +0.25 points on boundary questions (5% improvement)
- All conditions: identical on implementation questions (0% difference)

### Implications for Yggdrasil

1. **Hierarchy is justified** as a product feature, primarily because it provides efficient inheritance of parent context. The alternative (flat with manual content duplication) would achieve 95% of the information value but with higher maintenance cost and budget waste.

2. **The "hierarchy" XML tag in context packages is correct design**. It communicates both content (inherited from parent) and structure (architectural nesting). Removing the structural signal loses 5% of the boundary question value.

3. **For nodes with no children**, hierarchy provides no benefit. A flat node at the top level with complete artifacts matches a hierarchical child. Hierarchy only pays for itself when a parent has multiple children that share domain context.

4. **The critical investment is parent artifact quality.** A parent with a detailed responsibility.md (domain scope, in-scope, out-of-scope, delegation targets) provides the majority of hierarchy's value. A parent with a minimal or empty responsibility.md would provide almost no benefit regardless of the hierarchical structure.

### Threat to validity

This experiment tests one parent-child pair in one codebase. The parent's responsibility.md is well-written and the child's responsibility.md has significant overlap (both list similar in-scope items). In cases where parent and child have less overlap (e.g., a utility library under a domain module), the parent content value might be lower. The structural value might be higher in deep hierarchies (3+ levels) where the nesting communicates more architectural information.
