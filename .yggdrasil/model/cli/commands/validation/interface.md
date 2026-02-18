# Validation Commands Interface

| Function | Command | Key options / behavior |
| -------- | ------- | ----------------------- |
| `registerValidateCommand` | validate | --scope all\|node-path. Uses tolerateInvalidConfig. Outputs errors (red), warnings (yellow), summary. |
| `registerBuildCommand` | build-context | --node \<path\> (required). Validates first; exits 1 on structural errors. Outputs Markdown + budget status. Exits 1 if budget error. |

Errors to stderr, process.exit(1) on failure.
