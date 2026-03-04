# Build Context Command Interface

| Function | Signature | Command | Options |
| -------- | --------- | ------- | ------- |
| registerBuildCommand | (program: Command) => void | build-context | --node (required) |

**Return:** void. Contract: errors to stderr, process.exit(1) on failure.

## Failure Modes

**Propagated from loadGraph:**

- Missing .yggdrasil/: `Error: No .yggdrasil/ directory found. Run 'yg init' first.`

**Command-specific:**

- Node not found: exits when node path does not exist in graph.
- Validation errors: blocks build-context if graph has structural errors (E001-E017). User must fix errors first.

**Generic:** I/O errors — standard Node.js Error, caught and reported to stderr.
