# Drift Command Constraints

- **Scope values:** `--scope` must be `"all"` (default) or a valid node path that exists in the graph. Any other value causes exit with error.
- **Scoped node must have mapping:** When scope is a specific node, that node must have a `mapping` field. Drift detection requires mapped files to compare hashes against.
- **drift is read-only:** The `drift` command never writes `.drift-state` or modifies any graph artifact or source file. It only reads the current state and reports.
- **drift-sync writes only `.drift-state`:** The `drift-sync` command updates the stored hash baseline in `.drift-state`. It never modifies graph artifacts or source files.
- **Exit code reflects drift status:** Exit 0 when no drift detected, exit 1 when any entry has source-drift, graph-drift, full-drift, missing, or unmaterialized status.
