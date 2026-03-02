# Journal Management Flow

## Business context

During work sessions, agents record observations, decisions, and context that should persist but don't yet belong in the graph. The journal serves as a staging area — entries accumulate during work and are consolidated into graph artifacts at session end or during the next preflight.

## Trigger

Agent runs `yg journal-add --note "..."`, `yg journal-read`, or `yg journal-archive`.

## Goal

Persist temporary observations for later graph consolidation. Provide read access to pending entries. Archive consolidated entries.

## Participants

- `cli/commands/journal` — three subcommands: add (append entry), read (list pending), archive (move to timestamped file)
- `cli/io` — journal-store: read/write `.journal.yaml`, append entries, archive to `journals-archive/`

## Paths

### Happy path (add)

Find ygg root; append entry with timestamp, note, optional target node. Output: confirmation with entry details.

### Happy path (read)

Find ygg root; read `.journal.yaml`. Output: entries in chronological order, or "No pending journal entries."

### Happy path (archive)

Find ygg root; read entries; write to `journals-archive/YYYY-MM-DDTHH-MM-SS.yaml`; clear `.journal.yaml`. Output: archive filename and entry count.

### Empty journal

Archive with 0 entries: no-op, output "No entries to archive." Read with 0 entries: output "No pending journal entries."

## Invariants across all paths

- Journal-add always appends, never overwrites.
- Archive is atomic: entries move from `.journal.yaml` to archive file.
- Journal entries have ISO timestamps (Date.now exception from deterministic aspect — journal timestamps are metadata).
