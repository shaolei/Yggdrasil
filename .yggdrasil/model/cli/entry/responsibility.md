# Entry Responsibility

CLI entry point — bin.ts. Initializes Commander with name `yg`, description, version 0.1.0. Registers all 13 subcommands via register*Command(program). Calls program.parse() for argv handling.

**In scope:**

- Creating Commander instance
- Importing and invoking registerInitCommand, registerBuildCommand, registerValidateCommand, registerDriftCommand, registerDriftSyncCommand, registerStatusCommand, registerTreeCommand, registerOwnerCommand, registerDepsCommand, registerImpactCommand, registerJournalAddCommand, registerJournalReadCommand, registerJournalArchiveCommand
- Parsing process.argv

**Out of scope:**

- Individual command logic (cli/commands)
- Graph loading, context building, validation, drift (cli/core)
