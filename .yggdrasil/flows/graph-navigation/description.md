# Graph Navigation Flow

## Business context

Agent or user needs to locate elements in the graph: find which node owns a file, browse the hierarchy, or trace forward dependencies. These are navigational queries that answer "where is it?" and "what depends on what?"

## Trigger

User runs `yg owner --file <path>`, `yg tree [--root <path>]`, or `yg deps --node <path>`.

## Goal

Provide structural navigation of the graph — locating nodes, visualizing hierarchy, tracing dependency chains.

## Participants

- `cli/commands/owner` — resolves file path to owning node via mapping comparison
- `cli/commands/tree` — renders graph hierarchy as tree with metadata
- `cli/commands/deps` — formats forward dependency tree for a node
- `cli/core/loader` — loads graph from `.yggdrasil/`

## Paths

### Happy path (owner)

Graph loads; file path is normalized and compared against node mappings. Output: file → node path or "no graph coverage".

### Happy path (tree)

Graph loads; hierarchy rendered from root or subtree. Output: indented tree with node types, aspects, relation counts.

### Happy path (deps)

Graph loads; dependency resolver builds tree from node's relations. Output: formatted dependency tree.

### Node/path not found

`tree --root <invalid>`: exit 1 "path not found". `deps --node <invalid>`: exit 1 "Node not found". `owner --file <valid-but-unmapped>`: "no graph coverage" (not an error).

## Invariants across all paths

- Read-only: navigation never modifies the graph.
- Deterministic: same graph state → same output.
