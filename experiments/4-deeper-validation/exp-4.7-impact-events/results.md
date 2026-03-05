# Experiment 4.7: Re-run Impact Analysis with Event Relations -- Results

## Phase 1: Inventory of Event Relations in the Graph

### Exhaustive search of all 16 node.yaml files

Every `node.yaml` in `/workspaces/hoppscotch/.yggdrasil/model/` was read. A grep for `emits` and `listens` across the entire `.yggdrasil/model/` directory returned **zero matches**.

**Event relations in the Hoppscotch graph: 0**

All 14 relations in the graph are structural (`type: calls`). No node declares `type: emits` or `type: listens`.

Confirmed by `yg status`:

```
Relations: 14 structural, 0 event
```

### Relation inventory by node

| Node | Relation count | Types |
|---|---|---|
| team-collection-service | 1 | calls |
| team-service | 1 | calls |
| admin-service | 6 | calls (all) |
| team-request-service | 2 | calls (all) |
| team-environments-service | 1 | calls |
| team-invitation-service | 2 | calls (all) |
| auth-service | 1 | calls |
| user-service | 0 | (none) |
| All 8 module nodes | 0 each | (none) |

**Finding: The Hoppscotch graph was created during Experiment 3 (iteration) before the `emits`/`listens` relation types were added to the product. The graph models only synchronous call dependencies, not asynchronous event flows.**

---

## Phase 2: Updated Impact Analysis Output

### Impact output for all 8 service nodes

Each service node was tested with `yg impact --node <path>`. Results:

| Node | Directly dependent | Event-connected section? | Transitively dependent |
|---|---|---|---|
| team-collection-service | 2 (admin-service, team-request-service) | No | 0 |
| team-service | 5 (admin, team-collection, team-envs, team-invitation, team-request) | No | 0 |
| user-service | 4 (admin, auth, team-invitation, team-service) | No | 3 transitive |
| admin-service | 0 | No | 0 |
| team-environments-service | 1 (admin-service) | No | 0 |
| team-invitation-service | 1 (admin-service) | No | 0 |
| team-request-service | 1 (admin-service) | No | 0 |
| auth-service | 0 | No | 0 |

The "Event-connected" section **never appeared** in any output because no event relations exist in the graph. The code correctly omits this section when `eventDependents.length === 0`:

```typescript
if (eventDependents.length > 0 && !methodFilter) {
    process.stdout.write('\nEvent-connected:\n');
    ...
}
```

### Event dependency filtering

`yg deps --node <path> --type event` was tested for multiple nodes. All returned the node itself with no event dependencies, confirming 0 event relations.

### New output format verification

The impact tool does include the correct code paths for event tracking:

1. **Inbound event relations**: Scans all nodes for `emits`/`listens` targeting the analyzed node
2. **Outbound event propagation**: If the analyzed node `emits` to a target, finds all nodes that `listens` on the same target
3. **Output section**: "Event-connected:" header with `path (type: eventName)` format
4. **Total scope inclusion**: Event dependents are merged into `allAffected` set

The feature is correctly implemented but has no data to operate on in this test repository.

---

## Phase 3: Comparison to 4.5 Baseline

### S3 Revisited: Event Payload Change (`team_col_added`)

**4.5 baseline** (old tool, no event tracking code):
- Predicted: admin-service, team-request-service (structural dependents of team-collection-service)
- Actual affected by event change: team-collection.resolver.ts (self-module), pubsub/topicsDefs.ts (unmapped), frontend files (external)
- TP: 0, FP: 2, FN: 0 mapped / 1 unmapped
- The tool had no mechanism to surface event consumers

**4.7 result** (new tool, event tracking code present):
- Predicted: **identical** -- admin-service, team-request-service (same structural dependents)
- Event-connected section: **absent** (no emits/listens relations in graph)
- TP: 0, FP: 2, FN: 0 mapped / 1 unmapped
- **No change in recall or precision**

### Why no improvement?

The feature improvement is in the **tool algorithm**, but the **graph data** was not enriched to match. For S3 to show improvement, the graph would need:

```yaml
# In team-collection-service/node.yaml
relations:
  - target: team/team-service
    type: calls
    consumes: [getTeamMember]
  - target: pubsub                    # NEW: virtual event bus node
    type: emits
    event_name: team_coll_added

# In a hypothetical resolver node
relations:
  - target: pubsub                    # NEW: same target
    type: listens
    event_name: team_coll_added
```

Or alternatively, using direct node-to-node event relations:

```yaml
# In team-collection-service/node.yaml
  - target: team-collections          # Module that contains the subscriber (resolver)
    type: emits
    event_name: team_coll_added
```

Neither form exists in the current Hoppscotch graph.

### All 5 Scenarios: Unchanged

| Scenario | 4.5 Precision (mapped) | 4.5 Recall (mapped) | 4.7 Precision (mapped) | 4.7 Recall (mapped) | Delta |
|---|---|---|---|---|---|
| S1: Method signature | 0% | N/A | 0% | N/A | 0 |
| S2: Return type | 80% | 100% | 80% | 100% | 0 |
| S3: Event payload | 0% | N/A | 0% | N/A | 0 |
| S4: Aspect change | 100% | 100% | 100% | 100% | 0 |
| S5: Flow change | 75% | 100% | 75% | 100% | 0 |

**Overall improvement: 0% across all scenarios and all metrics.**

---

## Phase 4: Actual Event Topology in Hoppscotch

### Publishers (emitters)

Manual code trace of all `pubsub.publish(...)` calls across mapped services:

| Service | Events published | Count |
|---|---|---|
| team-collection-service | `team_coll/*/coll_added`, `coll_updated`, `coll_removed`, `coll_moved`, `coll_order_updated` | 9 publish sites |
| team-service | `team/*/member_added`, `member_updated`, `member_removed` | 3 publish sites |
| team-environments-service | `team_env/*/env_created`, `env_updated`, `env_deleted`, `env_clear_all`, `env_deleted_many` | 5 publish sites |
| team-request-service | (via resolver, not service) | 0 in service |
| team-invitation-service | `team/*/invite_added`, `invite_removed` | 2 publish sites |
| user-service | `user/*/updated`, `user/*/deleted` | 3 publish sites |
| admin-service | `admin/*/invited` | 1 publish site |
| auth-service | (none) | 0 |

### Subscribers (listeners)

All `pubsub.asyncIterator(...)` calls in resolvers:

| Resolver location | Events subscribed | Resolver mapped? |
|---|---|---|
| team-collection.resolver.ts | `team_coll/*` events (added, updated, removed, moved, order) | Parent: team-collections module |
| team.resolver.ts | (none found -- team member events not subscribed in resolver?) | Parent: team module |
| team-request.resolver.ts | `team_req/*` events (created, updated, deleted, order, moved) | Parent: team-request module |
| team-environments.resolver.ts | `team_env/*` events | Parent: team-environments module |
| user.resolver.ts | `user/*/updated`, `deleted` | Parent: user module |
| sort-team-collection.resolver.ts | `team_coll_root/*/sorted`, `team_coll_child/*/sorted` | Unmapped |
| user-collection.resolver.ts | `user_coll/*` events | Unmapped |
| user-request.resolver.ts | `user_request/*` events | Unmapped |
| user-history.resolver.ts | `user_history/*` events | Unmapped |
| user-environments.resolver.ts | `user_environment/*` events | Unmapped |
| user-settings.resolver.ts | `user_settings/*` events | Unmapped |

### What emits/listens relations SHOULD exist

For the mapped services, at minimum:

| From (emitter) | To (listener location) | Event pattern | Both mapped? |
|---|---|---|---|
| team-collection-service | team-collections (resolver) | team_coll_added, etc. | Same module (self) |
| team-service | team (resolver) | member events | Same module (self) |
| team-environments-service | team-environments (resolver) | env events | Same module (self) |
| team-invitation-service | team (resolver via team module) | invite events | Cross-module |
| user-service | user (resolver) | user events | Same module (self) |
| admin-service | admin (resolver) | admin events | Same module (self) |

**Key finding: Most PubSub event flows in Hoppscotch are INTRA-MODULE** -- the service publishes and the resolver in the same module subscribes. The event relations would largely connect services to their own parent modules, which are already in the same hierarchy. There is only one clear cross-module event flow (team-invitation-service publishes to `team/*/invite_added`, which could be listened to by team.resolver.ts).

The significant cross-boundary consumers are in the **frontend** (GraphQL subscriptions) and in **unmapped backend services** (user-collection, user-request, user-history, shortcode, etc.). Adding emits/listens relations to the current graph would primarily formalize intra-module flows rather than revealing new cross-module blast radius.

---

## Summary

### Quantitative Results

| Metric | 4.5 Baseline | 4.7 Result | Delta |
|---|---|---|---|
| Event relations in graph | 0 | 0 | 0 |
| "Event-connected" sections shown | N/A (feature absent) | 0 (feature present, no data) | 0 |
| S3 Recall (mapped) | N/A (0 actual) | N/A (0 actual) | 0 |
| S3 Recall (all components) | 0% | 0% | 0 |
| Overall Recall (mapped) | 100% | 100% | 0 |
| Overall Recall (all components) | 35% | 35% | 0 |
| Overall Precision (mapped) | 85% | 85% | 0 |

### Why Zero Improvement

The event tracking feature is a **tool-side improvement** that requires **graph-side enrichment** to produce results. The Hoppscotch graph was created before `emits`/`listens` relation types existed in the product, and was never updated with event relations. The tool correctly implements:

1. Scanning for inbound `emits`/`listens` relations targeting the analyzed node
2. Propagating through outbound `emits` to find corresponding `listens` nodes
3. Displaying "Event-connected:" section in output
4. Including event dependents in total scope count
5. Validating unpaired events (W009 warning)
6. Counting event vs structural relations separately in `yg status`

All of this machinery is verified to exist in the CLI source code (`impact.ts` lines 366-398, `validator.ts` lines 688-731, `dependency-resolver.ts` event filtering, `status.ts` separate counting). But with 0 event relations in the test graph, none of it activates.

### Is This a Valid Test of the Feature?

**No.** This experiment cannot measure the improvement because the precondition (event relations in the graph) is not met. It is analogous to testing a search engine improvement with an empty index -- the algorithm may be perfect, but there is nothing to search.

To properly test the event tracking feature, one would need to either:

1. **Enrich the Hoppscotch graph** with emits/listens relations (at least 6-10 event relations mapping the PubSub topology), then re-run S3
2. **Use a different test repo** that already has event relations modeled

### Value Assessment of Event Relations for Hoppscotch

Even if event relations were added, the improvement for S3 specifically would be limited because:

- The `team_col_added` event publisher and subscriber are in the **same module** (team-collections)
- Cross-module event consumers are in the **frontend** (unmapped) or **unmapped backend services**
- The one cross-module backend event flow (team-invitation to team module) would add 1 new edge

Estimated impact of enriching the Hoppscotch graph with event relations:

| Scenario | Current recall (all) | Estimated with events | Reason |
|---|---|---|---|
| S3: Event payload | 0% | 0% | Subscribers are same-module or unmapped |
| S1: Method signature | 0% | 0% | Not an event change |
| S2: Return type | 33% | 33% | Not an event change |
| S4: Aspect change | 40% | 40% | Not an event change |
| S5: Flow change | 50% | 50% | Not an event change |

**Even with full event relation enrichment, the Hoppscotch graph would see near-zero improvement** because the PubSub topology is predominantly intra-module and the cross-boundary consumers are unmapped.

### Conclusions

1. **The event tracking feature exists and is correctly implemented** in the CLI. The code paths for collecting, propagating, displaying, and counting event relations are verified.

2. **The Hoppscotch test graph does not exercise the feature.** Zero event relations means zero activation of the new code paths.

3. **The binding constraint remains graph coverage**, not tool algorithm. This is the same conclusion as Exp 4.5. The event tracking improvement addresses blind spot #3 from 4.5 ("Event chains not traced"), but only when the graph actually contains event relations.

4. **The Hoppscotch PubSub topology is not ideal for testing event tracking.** Most events are intra-module (service publishes, resolver in same module subscribes). A codebase with cross-service event-driven architecture (e.g., microservices communicating via events) would be a better test target.

5. **Recommendation**: To validate the event tracking feature, either:
   - Create a synthetic test scenario with explicit emits/listens relations
   - Find or create a graph for a microservices codebase with cross-service event flows
   - Add emits/listens relations to the Hoppscotch graph for the one cross-module flow (team-invitation events) and test that specific case
