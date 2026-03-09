# Select Command Responsibility

**In scope:** `yg select --task <description> [--limit <n>]`. Find graph nodes relevant to a natural-language task description.

- Load graph via `loadGraph(yggRoot)`.
- Delegate selection to `selectNodes(graph, task, limit)` from cli/core/node-selector.
- Output format: YAML array to stdout via `yamlStringify`. Each entry has `node`, `score`, `name`.
- Default limit: 5. Empty results produce empty YAML array (`[]`).

**Consumes:** loadGraph (cli/core/loader), selectNodes (cli/core/node-selector), findYggRoot (cli/utils).

**Out of scope:** Context assembly (use `yg build-context`), impact analysis (use `yg impact`).
