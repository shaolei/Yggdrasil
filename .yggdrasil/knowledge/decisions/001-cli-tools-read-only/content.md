# CLI Tools Never Write to Graph

**Reference:** docs/idea/foundation.md (Division of labor), engine.md (Tool responsibility boundary)

The CLI is a **deterministic engine**. It reads the graph, validates it, builds context packages, detects drift, and manages operational metadata. It does **not** create nodes, add relations, or write artifacts.

**What the CLI writes:**

- `.yggdrasil/.drift-state` — after `drift-sync`, records file hashes
- `.yggdrasil/.journal.yaml` — after `journal-add`, appends entry; after `journal-archive`, moves to archive
- `.yggdrasil/` structure — only during `init` (one-time bootstrap)

**What the CLI never writes:**

- `model/**/node.yaml`, `model/**/*.md` — agent or human writes these
- `aspects/**`, `flows/**`, `knowledge/**` — agent or human writes these
- `config.yaml` — agent or human edits after init

This is analogous to compiler–programmer: the programmer writes code, the compiler checks correctness and reports errors. The agent writes the graph; the CLI validates and gives feedback.
