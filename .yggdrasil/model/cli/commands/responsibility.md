# Commands Responsibility

CLI commands module — groups 13 command handlers registered in Commander. Each handler is a subcommand of `yg`. All use process.cwd() as project root. Errors to stderr, process.exit(1) on failure.

**In scope:**

- Child nodes implement init, build-context, validate, drift, drift-sync, status, tree, owner, deps, impact, journal-add, journal-read, journal-archive.

**Out of scope:**

- Graph loading, context building, validation logic (cli/core)
- YAML parsing, drift state, journal file format (cli/io)
