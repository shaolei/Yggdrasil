# Drift Commands Interface

| Function | Command | Key options / behavior |
| -------- | ------- | ----------------------- |
| `registerDriftCommand` | drift | --scope all\|node-path. Exits 1 if any drift/missing/unmaterialized. |
| `registerDriftSyncCommand` | drift-sync | --node \<path\>. Writes current hash to .drift-state. |

Errors to stderr, process.exit(1) on failure.
