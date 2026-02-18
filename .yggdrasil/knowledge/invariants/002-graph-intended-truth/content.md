# Graph Is Intended Truth

**Reference:** docs/idea/foundation.md (Two worlds: graph and results)

When graph and files disagree, the **graph represents the intended state**. If the file change was deliberate, update the graph to match — but the graph is never silently wrong.

**Drift resolution:**

- **Absorption:** Update graph to reflect file changes. Results become truth.
- **Rejection:** Re-materialize from graph. Graph remains truth.

The human decides. The agent executes. Unresolved drift is the failure mode — the system guarantees drift is always visible and always resolved.
