# Graph Ops Commands Responsibility

**In scope:** `yg status`, `yg tree`, `yg owner`, `yg deps`, `yg impact`.

- **status:** loadGraph, detectDrift, validate, output summary counts.
- **tree:** loadGraph, walk model, output tree with type and relation count.
- **owner:** loadGraph, find node whose mapping contains file path.
- **deps:** loadGraph, resolveDeps or formatDependencyTree. Trims --node and strips trailing slash.
- **impact:** loadGraph, find reverse deps, optionally simulate context changes (HEAD vs current graph) and report drift status of mapped files for affected nodes. Trims --node and strips trailing slash.

**Out of scope:** Init, validation, drift, journal (other command groups).
