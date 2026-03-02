# IO State Files

## .drift-state

YAML file at `.yggdrasil/.drift-state`. Maps node paths to `DriftNodeState` objects:

```
<node-path>:
  hash: <sha256-hex>       # canonical hash of all tracked files (source + graph)
  files:                    # per-file hashes for granular change detection
    <relative-path>: <sha256-hex>
```

Written by `drift-sync` command via `writeDriftState`. Read by `detectDrift` via `readDriftState`. Legacy format (node-path mapped to a plain string hash) is silently skipped during reads. This file should be committed to the repository so drift baselines persist across sessions.

## .journal.yaml

YAML file at `.yggdrasil/.journal.yaml`. Contains an `entries` array of `JournalEntry`:

```
entries:
  - at: <ISO-8601 timestamp>
    target: <optional node path>
    note: <text>
```

Written by `journal-add` via `appendJournalEntry`. Read by `journal-read` via `readJournal`. Returns empty array if file is missing or unparseable. This file is gitignored — it is session-local working state.

## journals-archive/

Directory at `.yggdrasil/journals-archive/`. Created on first archive. Contains timestamped copies of archived journals:

- Filename format: `.journal.YYYYMMDD-HHmmss.yaml`
- Created by `journal-archive` via `archiveJournal`, which renames (moves) the active `.journal.yaml` into this directory.
- UTC timestamps are used for the filename.
