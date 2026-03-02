# Drift Detector Constraints

- **Detection is read-only:** `detectDrift` never modifies the graph, source files, or `.drift-state`. It reads the stored drift state and computes current hashes for comparison.
- **drift-sync writes only `.drift-state`:** `syncDriftState` updates the drift state file with current hashes. It never modifies graph artifacts or source files.
- **Per-file hashing uses SHA-256:** Individual file hashes are computed with `createHash('sha256')`. The canonical hash is a SHA-256 digest of sorted `path:hash` pairs.
- **Bidirectional detection:** Changed files are categorized as `source` or `graph` based on whether their path falls under `.yggdrasil/`. Both categories are tracked independently to distinguish source-drift, graph-drift, and full-drift.
- **Missing source files before hash comparison:** If all mapped source paths are missing on disk, the node is classified as `missing` regardless of stored hash state. This check runs before any hash computation.
