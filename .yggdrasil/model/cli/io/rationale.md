# IO Rationale

**Reference:** docs/idea/graph.md (File structure, schemas), engine.md (Drift state, journal), tools.md (Schemas)

The graph is **files on disk**. model/, aspects/, flows/, knowledge/ are directories with YAML and Markdown. IO is the layer that reads these files and produces typed structures for core. It also manages operational metadata: .drift-state and .journal.yaml.

**Why tools don't write graph knowledge:** Per 1-foundation.md, the agent writes the graph. Tools read and validate. IO's write operations are limited to: drift-state (after drift-sync), journal (add/archive). These are operational state, not architectural knowledge. The boundary is strict: config, node.yaml, artifacts, knowledge — agent writes. Drift state, journal — tools manage.

**Why absolute paths:** Callers (core, commands) resolve from project root or yggRoot. IO receives full paths. This avoids ambiguity about working directory and makes the contract explicit.

**Why YAML for metadata:** Human-editable, diffable, versionable. The graph lives in git. YAML is the standard for config-like structures in the Node ecosystem. Parsers throw on error — no silent fallbacks. Invalid input is a hard failure.
