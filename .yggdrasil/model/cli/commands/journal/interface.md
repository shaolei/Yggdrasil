# Journal Commands Interface

Public API consumed by cli/entry. Named exports only.

| Function | Signature | Command | Options |
| -------- | --------- | ------- | ------- |
| registerJournalAddCommand | (program: Command) => void | journal-add | --note (required), --target (optional node path). |
| registerJournalReadCommand | (program: Command) => void | journal-read | None. |
| registerJournalArchiveCommand | (program: Command) => void | journal-archive | None. |

**Return:** void. All register subcommands on the Commander program.

**Contract:** Errors to stderr, process.exit(1) on failure. Implements patterns/command-error-handling.

## Failure Modes

**Propagated from findYggRoot:**

- Missing .yggdrasil/: `Error: No .yggdrasil/ directory found. Run 'yg init' first.`
- .yggdrasil exists but is not a directory: `Error: .yggdrasil exists but is not a directory (${yggPath}). Run 'yg init' in a clean location.`

**Propagated from appendJournalEntry, readJournal, archiveJournal:**

- I/O errors: permission denied, missing files — standard Node.js Error.

**Generic:** All errors caught and reported to stderr, process.exit(1).
