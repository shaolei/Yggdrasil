# Select Command Interface

## `registerSelectCommand(program: Command): void`

Registers the `yg select` subcommand on the Commander program.

**Options:**

- `--task <description>` (required) — Natural-language task description.
- `--limit <n>` (optional, default: `5`) — Maximum nodes to return.

**Output:** YAML array to stdout. Each entry: `{ node, score, name }`. Empty array (`[]`) when no matches found.

**Exit codes:** 0 on success, 1 on error (missing `.yggdrasil/`, invalid graph).
