# Node Selector Interface

## Types

```typescript
interface SelectionResult {
  node: string;   // node path (relative to model/)
  score: number;  // relevance score (S1: weighted hits, S2: 1)
  name: string;   // node display name from yg-node.yaml
}
```

## Functions

### `selectNodes(graph: Graph, task: string, limit: number): SelectionResult[]`

Find graph nodes relevant to a task description.

**Parameters:**

- `graph` — Loaded graph object with nodes, aspects, and flows.
- `task` — Natural-language task description. Tokenized internally (lowercase, split, stop-word removal).
- `limit` — Maximum results to return.

**Returns:** Array of `SelectionResult` sorted by score descending, then depth descending (deeper nodes first on ties). Empty array if no matches found.

**Behavior:**

1. Run S1 keyword matching against all node artifacts (responsibility x3, interface x2, aspect content x2, others x1).
2. If S1 produces results, return top `limit` entries.
3. If S1 produces nothing, run S2 flow-based fallback — match task tokens against flow descriptions, return participants of matching flows with score 1.

## Failure Modes

- Empty task string: returns empty array (no tokens to match).
- Graph with no nodes: returns empty array.
- Graph with no flows: S2 fallback returns empty array (S1 still runs).
