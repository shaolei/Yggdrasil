# Init Command Interface

| Function | Command | Key options / behavior |
| -------- | ------- | ----------------------- |
| `registerInitCommand` | init | --platform cursor\|claude-code\|copilot\|generic. Creates .yggdrasil/, copies graph-templates, writes config, installs rules. Fails if .yggdrasil/ exists. |

Errors to stderr, process.exit(1) on failure.
