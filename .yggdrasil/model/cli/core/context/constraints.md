# Context Builder Constraints

- **Layer assembly order is fixed:** The 5-layer sequence is: (1) Global config, (2) Hierarchy ancestors root-to-parent, (3) Own node artifacts, (4) Relational dependencies and events, (5) Flows then Aspects. This order is invariant and determines context precedence.
- **structural_context gates relational inclusion:** For structural relations (uses, calls, extends, implements), only artifacts marked `structural_context: true` in config are included from the dependency target. If no structural artifacts exist, all configured artifacts fall back.
- **Context assembly is read-only:** `buildContext` never modifies the graph, node artifacts, or any files. It reads the in-memory graph and node artifact files, then assembles a `ContextPackage`.
- **Aspect expansion detects cycles:** The `expandAspects` function tracks a recursion stack and throws if an aspect implies cycle is detected (e.g., A implies B implies A).
- **Flow participation is transitive through hierarchy:** A node participates in a flow if the node itself or any of its ancestors is listed in the flow's `nodes` array.
