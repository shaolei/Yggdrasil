# Context Package Must Be Sufficient

**Reference:** docs/idea/foundation.md (Self-calibrating granularity), engine.md (Success metric)

**Invariant:** If an agent must explore the repository to understand what a node should do, the context package — and therefore the graph — is incomplete.

The fix is always in the graph, not in the exploration strategy. Bad output means the graph is missing something: a constraint, an interface detail, a decision record. Fix the specification. A patched output re-breaks at the next materialization because the graph has not changed.

**Implication for graph authors:** Every artifact must be sufficiently precise. Responsibility must state boundaries clearly. Interface must list every public method with parameters, return types, contracts. Constraints must enumerate validation rules. Errors must document error conditions and recovery. Add details where the agent produces wrong output without them.
