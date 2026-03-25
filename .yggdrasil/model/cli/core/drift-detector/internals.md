## Logic

# Drift Detector Logic

## detectDrift

For each mapped node (or single node if filterNodePath):

1. **No stored entry** (.drift-state/ has no file for nodePath):
   - `allPathsMissing(projectRoot, mappingPaths)` — access() each path; returns true only when ALL paths missing
   - If all missing → status `unmaterialized`, details "No drift state recorded, files do not exist"
   - If any exist → status `drift`, details "No drift state recorded, files exist (run drift-sync after materialization)"

2. **Stored entry exists**:
   - Get storedHash via getCanonicalHash(storedEntry)
   - Try: currentHash = hashForMapping(projectRoot, mapping)
   - If hash mismatch → status `drift`, details = diagnoseChangedFiles (per-file diff) or "File(s) modified since last sync"
   - If hashForMapping throws (paths don't exist) → status `missing`, details "Mapped path(s) do not exist"
   - If hash matches → status `ok`

## diagnoseChangedFiles

- perFileHashes(projectRoot, mapping) → current
- If no storedFileHashes → return all current paths (sorted)
- Else: compare each current hash to stored; add to changed if different or missing
- Add deleted paths (in stored but not in current) with " (deleted)" suffix
- Return sorted list

## allPathsMissing

- For each mappingPath: access(absPath). If any succeeds → return false
- Return true only when all paths fail (ENOENT)

## syncDriftState

- Read existing state for the node via readNodeDriftState (per-node JSON file)
- Compute currentHash via hashForMapping
- Per-file hashes via perFileHashes → build files Record
- Detect source-only change: when hash changed, compare old vs new per-file hashes, categorize each changed file as source or graph (by checking if path starts with `.yggdrasil/` prefix). Set `sourceOnlyChange = true` when source files changed but no graph artifacts changed — this signals W018 to the drift-sync command.
- Write { hash, files, mtimes } via writeNodeDriftState to `.drift-state/<nodePath>.json`
- Return SyncResult { previousHash?, currentHash, sourceOnlyChange }
- GC (garbage collection of orphaned drift state files) runs during drift-sync --all

## Constraints

# Drift Detector Constraints

- **Detection is read-only:** `detectDrift` never modifies the graph, source files, or `.drift-state/`. It reads the stored per-node drift state and computes current hashes for comparison.
- **drift-sync writes only `.drift-state/`:** `syncDriftState` updates the per-node drift state JSON file (via `readNodeDriftState`/`writeNodeDriftState`) with current hashes. It never modifies graph artifacts or source files.
- **Per-file hashing uses SHA-256:** Individual file hashes are computed with `createHash('sha256')`. The canonical hash is a SHA-256 digest of sorted `path:hash` pairs.
- **Bidirectional detection:** Changed files are categorized as `source` or `graph` based on whether their path falls under `.yggdrasil/`. Both categories are tracked independently to distinguish source-drift, graph-drift, and full-drift.
- **Missing source files before hash comparison:** If all mapped source paths are missing on disk, the node is classified as `missing` regardless of stored hash state. This check runs before any hash computation.

## Decisions

# Drift Detector Decisions

**Bidirectional drift (source vs graph):** Either side of the code-graph relationship can change independently. Source files may be edited without updating graph artifacts, or graph artifacts may be updated without changing source. Detecting both directions separately enables the agent rules to prescribe different resolution strategies: source-drift means "update graph to match code," graph-drift means "review if code needs updating."

**Per-file hashing alongside canonical hash:** The canonical hash (SHA-256 of sorted path:hash pairs) determines whether any drift exists. Per-file hashes (`DriftNodeState.files`) enable granular reporting of exactly which files changed, categorized as source or graph. Without per-file tracking, the system could only report "something changed" without identifying which files drifted.

**Blackbox nodes excluded from drift detection:** Blackbox nodes are intentionally opaque — their source files are not modeled in the graph, so computing per-file hashes and tracking source-drift is wasted I/O that produces misleading signals. `detectDrift` skips them entirely, `syncDriftState` rejects them with an error, and `drift-sync --all` GC cleans up orphaned `.drift-state/` files for blackbox nodes.
