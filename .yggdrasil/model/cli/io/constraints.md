# IO Constraints

- **Paths:** All parser functions accept absolute file paths. Callers (core, commands) resolve from project root or yggRoot.
- **YAML:** Uses `yaml` package. Throws on parse errors. No schema validation beyond required fields.
- **Artifact reader:** Skips binary extensions (.png, .jpg, .pdf, .zip, etc.). Excludes node.yaml by default. Sorts output by filename for determinism.
- **Drift state:** Format is node-path → hash (string) or DriftNodeState { hash, files? }. Stored in .yggdrasil/.drift-state. Commit to repo.
- **Journal:** Stored in .yggdrasil/.journal.yaml. Gitignored. Archive format: journals-archive/.journal.YYYYMMDD-HHmmss.yaml.
- **Knowledge scope:** scope must be 'global' | { tags: string[] } | { nodes: string[] }. Tags and nodes must resolve.
