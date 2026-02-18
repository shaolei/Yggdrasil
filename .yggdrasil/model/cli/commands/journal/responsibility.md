# Journal Commands Responsibility

**In scope:** `yg journal-add`, `yg journal-read`, `yg journal-archive`.

- **journal-add:** findYggRoot, appendJournalEntry.
- **journal-read:** findYggRoot, readJournal, output entries.
- **journal-archive:** findYggRoot, archiveJournal. Moves .journal.yaml to archive.

**Out of scope:** Validation, drift, graph navigation (other command groups).
