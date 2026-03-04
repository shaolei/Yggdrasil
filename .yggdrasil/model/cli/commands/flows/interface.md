# Flows Command Interface

| Function | Signature | Command | Options |
| -------- | --------- | ------- | ------- |
| registerFlowsCommand | (program: Command) => void | flows | None |

**Return:** void. Contract: errors to stderr, process.exit(1) on failure.

## Failure Modes

**Propagated from loadGraph:**

- Missing .yggdrasil/: `Error: No .yggdrasil/ directory found. Run 'yg init' first.`

**No command-specific errors.**

**Generic:** I/O errors -- standard Node.js Error, caught and reported to stderr.
