# Deps Command Interface

| Function | Signature | Command | Options |
| -------- | --------- | ------- | ------- |
| registerDepsCommand | (program: Command) => void | deps | --node (required), --depth (optional int), --type (structural, event, all; default all) |

**Return:** void. Contract: errors to stderr, process.exit(1) on failure.

## Failure Modes

**Propagated from loadGraph:**

- Missing .yggdrasil/: `Error: No .yggdrasil/ directory found. Run 'yg init' first.`

**Propagated from formatDependencyTree:**

- Node not found: `Node not found: ${nodePath}`.

**Generic:** I/O errors — standard Node.js Error, caught and reported to stderr.
