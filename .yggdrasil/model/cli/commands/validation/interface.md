# Validation Commands Interface

Public API consumed by cli/entry. Named exports only.

| Function | Signature | Command | Options |
| -------- | --------- | ------- | ------- |
| registerValidateCommand | (program: Command) => void | validate | --scope (default: all). Uses tolerateInvalidConfig. |

**Return:** void. Registers subcommand on the Commander program.

**Contract:** Errors to stderr, process.exit(1) on failure. Implements patterns/command-error-handling.

## Failure Modes

**Propagated from loadGraph:**

- Missing .yggdrasil/: `Error: No .yggdrasil/ directory found. Run 'yg init' first.`
- model/ does not exist: `Directory .yggdrasil/model/ does not exist. Run 'yg init' first.`

**validate:** No command-specific errors; propagates from loadGraph, validate.

**Generic:** I/O errors -- standard Node.js Error, caught and reported to stderr.
