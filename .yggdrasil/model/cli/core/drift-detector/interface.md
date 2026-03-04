# Drift Detector Interface

- `detectDrift(graph: Graph, filterNodePath?: string): Promise<DriftReport>`
  - Parameters: `graph` (Graph), `filterNodePath` (string, optional) — when set, only that node is checked.
  - Returns: DriftReport with entries (nodePath, mappingPaths, status, details), totalChecked, okCount, driftCount, missingCount, unmaterializedCount.
  - Status: `ok` | `drift` | `missing` | `unmaterialized`. Skips nodes without mapping.

- `syncDriftState(graph: Graph, nodePath: string): Promise<{ previousHash?: string; currentHash: string }>`
  - Parameters: `graph` (Graph), `nodePath` (string).
  - Returns: `{ previousHash?: string; currentHash: string }` — previousHash if node had drift state, currentHash always.
  - Computes current hash from node mapping via hashForMapping, writes entry (hash + per-file hashes) to .drift-state via writeDriftState.

## Failure Modes

- **detectDrift**: `readDriftState` returns empty object on file missing/parse error; no throw. `hashForMapping` propagates read errors (ENOENT, permission denied) — caught as status 'missing', details 'Mapped path(s) do not exist'. `allPathsMissing` uses access() — ENOENT handled per path (returns true only when all paths missing). `diagnoseChangedFiles` catches errors and returns [].
- **syncDriftState**: Throws `Error("Node not found: ${nodePath}")` if node does not exist; throws `Error("Node has no mapping: ${nodePath}")` if node has no mapping. Propagates hashForMapping and writeDriftState errors.
