# Node Selector Responsibility

**In scope:** Task-based node selection. Given a natural-language task description and a loaded graph, find the most relevant nodes using a two-stage algorithm:

- **S1 (keyword matching):** Tokenize the task, match tokens against node artifacts with weighted scoring — responsibility x3, interface x2, aspect content x2, other artifacts x1. Return nodes sorted by score descending, with depth as tiebreaker for equal scores (deeper nodes rank first).
- **S2 (flow-based fallback):** When S1 returns no matches, tokenize flow descriptions and return participants of matching flows (score = 1).

**Consumes:** Graph, GraphNode, FlowDef (cli/model), tokenize (cli/utils).

**Exports:** `SelectionResult` interface (`{ node, score, name }`), `selectNodes(graph, task, limit)`.

**Out of scope:** Semantic/embedding-based search, query expansion, fuzzy matching. This is deterministic keyword matching only.
