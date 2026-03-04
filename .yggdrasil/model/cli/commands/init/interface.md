# Init Command Interface

Public API consumed by cli/entry. Named exports only.

| Function | Signature | Command | Options |
| -------- | --------- | ------- | ------- |
| registerInitCommand | (program: Command) => void | init | --platform (default: generic), --upgrade. |

**Platforms (PLATFORMS):** cursor, claude-code, copilot, cline, roocode, codex, windsurf, aider, gemini, amp, generic.

**Return:** void. Registers subcommand on the Commander program.

**Contract:** Errors to stderr, process.exit(1) on failure. Implements patterns/command-error-handling.

## Failure Modes

- **.yggdrasil/ exists (without --upgrade):** `Error: .yggdrasil/ already exists. Use --upgrade to refresh rules only.`
- **.yggdrasil exists but is not a directory:** `Error: .yggdrasil exists but is not a directory.`
- **Unknown platform:** `Error: Unknown platform '<platform>'. Use: cursor, claude-code, copilot, cline, roocode, codex, windsurf, aider, gemini, amp, generic`
- **Graph templates copy failure:** Warning to stderr, init continues (does not exit).
- **I/O errors:** permission denied, missing files — standard Node.js Error.
