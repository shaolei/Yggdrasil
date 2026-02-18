# Drift Commands Responsibility

**In scope:** `yg drift` and `yg drift-sync`.

- **drift:** loadGraph, detectDrift, output status per node. Trims --scope; empty treated as "all". Exits 1 if any drift/missing/unmaterialized.
- **drift-sync:** loadGraph, compute hash, writeDriftState. Trims --node and strips trailing slash. Records current file state after human resolves drift.

**Out of scope:** Validation, journal, graph navigation (other command groups).
