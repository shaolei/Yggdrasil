## Logic

# Drift Commands Logic

## drift command

1. loadGraph(process.cwd())
2. scope = (options.scope ?? 'all').trim() || 'all'
3. If scope !== 'all': validate node exists; validate node has mapping (else exit 1)
4. scopeNode = scope === 'all' ? undefined : scope
5. detectDrift(graph, scopeNode)
6. printReport(report, driftedOnly, limit):
   - Split entries into two sections via classifyForSection():
     - Source section: source-drift, full-drift, missing, unmaterialized (+ ok unless --drifted-only)
     - Graph section: graph-drift, full-drift (+ ok unless --drifted-only)
   - If --limit: slice each section to limit entries. Print truncation notice: "... N more (M total)".
   - For each section: print header, then per entry: status tag + nodePath, then changedFiles filtered by category
   - Summary: source-drift, graph-drift, full-drift, missing, unmaterialized counts. "(N ok hidden)" when --drifted-only, else ok count.
7. Exit 1 if any drift/missing/unmaterialized; else exit 0 (based on full report, not limited view)

## drift-sync command

1. Validate: either --node or --all must be provided. If neither, exit 1.
2. loadGraph(process.cwd())
3. If --all: collect all nodes where `!blackbox` and non-empty mappings. Sort. (Blackbox nodes are excluded — their source files are not modeled, so syncing them is meaningless. The subsequent GC step also removes any orphaned `.drift-state/` files for blackbox nodes.)
4. If --node: nodePath = trim, strip `./` and trailing `/`. If --recursive: collect nodePath + all descendants. Sort.
5. For each node to sync: skip nodes without mapping (unless explicitly requested without --recursive/--all). Call syncDriftState(graph, np) for each.
6. Output "Synchronized: ${np}" (green), hash line (previous 8 chars -> current 8 chars) per synced node.
7. If syncResult.sourceOnlyChange: emit W018 warning to stderr — "Source files changed but graph artifacts are unchanged. Update artifacts BEFORE syncing."
8. Exit 0

## Constraints

# Drift Command Constraints

- **Scope values:** `--scope` must be `"all"` (default) or a valid node path that exists in the graph. Any other value causes exit with error.
- **Scoped node must have mapping:** When scope is a specific node, that node must have a `mapping` field. Drift detection requires mapped files to compare hashes against.
- **drift is read-only:** The `drift` command never writes `.drift-state` or modifies any graph artifact or source file. It only reads the current state and reports.
- **drift-sync writes only `.drift-state`:** The `drift-sync` command updates the stored hash baseline in `.drift-state`. It never modifies graph artifacts or source files.
- **Exit code reflects drift status:** Exit 0 when no drift detected, exit 1 when any entry has source-drift, graph-drift, full-drift, missing, or unmaterialized status.

## Decisions

# Drift Command Decisions

**Separate drift and drift-sync commands:** Detection and resolution are intentionally distinct operations. `drift` is read-only analysis that can run safely in CI or at conversation start. `drift-sync` is a deliberate write action that records the current state as the new baseline. Merging them would risk accidental baseline resets during routine checks.

**--drifted-only flag:** The default output shows all nodes including those with `ok` status, which is useful for comprehensive audits. The `--drifted-only` flag hides ok entries to produce cleaner output for CI pipelines and automated checks where only actionable drift matters. The hidden count is still reported in the summary line.
