# Build Context Command Responsibility

**In scope:** `yg build-context --node <path> [--full]` or `yg build-context --file <path> [--full]`. Assemble and output context package for a node.

- `--file <path>`: resolves the owning node via `findOwner`, prints owner mapping to stderr, then proceeds as `--node`. Exits 1 if file has no graph coverage.
- `--node` and `--file` are mutually exclusive. At least one is required.
- Load graph via `loadGraph(process.cwd())`. Trim node path, strip leading `./` and trailing `/`.
- Collect relevant node paths (node, ancestors, relation targets, relation target ancestors) for scoped validation.
- Validate graph first: `validate(graph, 'all')`. If any errors (severity 'error') affect the node's context, block build-context and report validation failure. Unrelated errors are ignored with a count.
- `buildContext(graph, nodePath)` — assemble context package.
- `toContextMapOutput(pkg, graph)` — convert to structured map output.
- `formatContextYaml(mapOutput)` — format as YAML context map.
- If `--full`: collect and append full artifact file contents via `formatFullContent`.
- Output to stdout.

**Consumes:** loadGraph (cli/core/loader), buildContext + collectAncestors + toContextMapOutput (cli/core/context), validate (cli/core/validator), formatContextYaml + formatFullContent (cli/formatters), findOwner (cli/commands/owner), projectRootFromGraph (cli/utils).

**Out of scope:** Context assembly algorithm (cli/core/context), formatting logic (cli/formatters), validation rules (cli/core/validator).
