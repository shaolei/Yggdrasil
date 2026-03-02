# Journal Commands Logic

## journal-add

1. Resolve yggRoot from current working directory via `findYggRoot`.
2. Call `appendJournalEntry(yggRoot, note, target?)` which reads the existing journal, appends a new entry with ISO timestamp, and writes back.
3. Read the journal again to get the total count.
4. Print confirmation with total entry count to stdout.

## journal-read

1. Resolve yggRoot from current working directory.
2. Call `readJournal(yggRoot)` to load all pending entries.
3. If empty, print "Session journal: empty (clean state)" and return.
4. Otherwise, print header with entry count, then iterate entries: format each with date (trimmed to seconds), optional target node path, and note text.

## journal-archive

1. Resolve yggRoot from current working directory.
2. Call `archiveJournal(yggRoot)` which checks if `.journal.yaml` exists and has entries.
3. If no journal or empty, print "No active journal" and return null.
4. Otherwise, create `journals-archive/` directory if needed, generate a UTC timestamp filename (`.journal.YYYYMMDD-HHmmss.yaml`), and rename (move) the journal file to the archive.
5. Print confirmation with entry count and archive filename.
