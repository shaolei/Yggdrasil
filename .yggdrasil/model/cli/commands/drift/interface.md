# Drift Commands Interface

Public API consumed by cli/entry. Named exports only.

| Function | Signature | Command | Options |
| -------- | --------- | ------- | ------- |
| registerDriftCommand | (program: Command) => void | drift | --scope (default: all), --drifted-only, --limit (optional integer). Scope: all or node-path. |
| registerDriftSyncCommand | (program: Command) => void | drift-sync | --node or --all (one required), --recursive (optional). |

**Return:** void. Both register subcommands on the Commander program.

**Contract:** Errors to stderr, process.exit(1) on failure. Implements patterns/command-error-handling.

## Failure Modes

**Propagated from loadGraph:**

- Missing .yggdrasil/: `Error: No .yggdrasil/ directory found. Run 'yg init' first.`
- model/ does not exist: `Directory .yggdrasil/model/ does not exist. Run 'yg init' first.`

**drift command:**

- Node not found: `Error: Node not found: ${scope}` — when --scope is a node path that does not exist in the graph.
- Node has no mapping: `Error: Node has no mapping (does not participate in drift detection): ${options.scope}` — when --scope is a node that exists but has no mapping.

**drift-sync command:**

- Node not found: propagated from syncDriftState when node path does not exist in graph.
- Mapping paths missing: propagated from syncDriftState when node has no mapping or paths do not exist.

**Generic:** I/O errors (permission denied, missing files) — standard Node.js Error, caught and reported to stderr.
