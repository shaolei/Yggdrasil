# Owner Command Interface

Public API consumed by cli/entry. Named exports only.

| Function | Signature | Command | Options |
| -------- | --------- | ------- | ------- |
| registerOwnerCommand | (program: Command) => void | owner | --file (required) |

**Also exported:**

- `findOwner(graph: Graph, projectRoot: string, rawPath: string): OwnerResult` — resolves file to owning node. Used by owner command. OwnerResult includes `direct?: boolean` (true for exact match, false when file lies inside mapped directory).

**Return:** void for registerOwnerCommand. Contract: errors to stderr, process.exit(1) on failure.

## Failure Modes

**Propagated from loadGraph:**

- Missing .yggdrasil/: `Error: No .yggdrasil/ directory found. Run 'yg init' first.`

**Command-specific:**

- Path outside project: propagated from normalizeProjectRelativePath: `Path is outside project root: ${rawPath}`.
- Empty path: propagated from normalizeProjectRelativePath: `Path cannot be empty`.

**Generic:** I/O errors — standard Node.js Error, caught and reported to stderr.
