# Context Builder Logic

5-step deterministic assembly. Order is fixed; each step appends layers.

## Sequence

1. **Global** — config.yaml: stack, standards
2. **Hierarchy** — collectAncestors from node.parent up to root; for each ancestor, filter artifacts by config, build hierarchy layer
3. **Own** — node.yaml (read from disk) + filtered artifacts
4. **Relational** — for each relation: structural (uses/calls/extends/implements) → buildStructuralRelationLayer (consumes, failure, structural_context artifacts); event (emits/listens) → buildEventRelationLayer
5. **Flows** — flows where node or ancestor in flow.nodes; for each flow: flow artifacts
6. **Aspects** — union of aspect ids from hierarchy + own + flow layers (expanded via implies); for each resolved aspect, build aspect layer

Implementation note: steps 4–5 execute before step 6 internally so that flow-propagated aspect ids can be collected. buildSections reorders the output to match the spec: Global → Hierarchy → OwnArtifacts → Aspects → Relational (which merges structural deps, events, and flows).

## Output

- `layers`: array of ContextLayer
- `sections`: grouped by key (Global, Hierarchy, OwnArtifacts, Aspects, Relational). Relational merges structural dependencies, events, and flows.
- `tokenCount`: estimateTokens(fullText) — ~4 chars per token
- `mapping`: if node has mapping, add "Materialization Target" to own layers

## Structural vs Event Relations

- STRUCTURAL_RELATION_TYPES: uses, calls, extends, implements
- EVENT_RELATION_TYPES: emits, listens

Structural relations get interface/errors from target (structural_context). Event relations get event name + consumes.
