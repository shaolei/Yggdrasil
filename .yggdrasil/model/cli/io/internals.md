## Constraints

# IO Constraints

- **Paths:** All parser functions accept absolute file paths. Callers (core, commands) resolve from project root or yggRoot.
- **YAML:** Uses `yaml` package. Throws on parse errors. No schema validation beyond required fields.
- **Artifact reader:** Skips binary extensions (.png, .jpg, .pdf, .zip, etc.). Excludes yg-node.yaml by default. Sorts output by filename for determinism.
- **Drift state:** Per-node storage under `.yggdrasil/.drift-state/` directory. Each node's state is stored in `.drift-state/<node-path>.json` as a JSON file containing `{ hash, files, mtimes? }`. Legacy single-file format (`.drift-state` as a file) is auto-migrated on read. Commit to repo.
- **Knowledge scope:** scope must be 'global' | { tags: string[] } | { nodes: string[] }. Tags and nodes must resolve.

## State

# IO State Files

## .drift-state/

Per-node directory at `.yggdrasil/.drift-state/`. Each node's state is stored as `<node-path>.json`:

```
.drift-state/
  cli/
    commands/
      aspects.json    # { "hash": "<sha256>", "files": {...}, "mtimes": {...} }
    core/
      loader.json
```

Each JSON file contains a `DriftNodeState`: canonical hash, per-file hashes, and optional mtimes. Written by `drift-sync` command via `writeNodeDriftState`. Read by `detectDrift` via `readNodeDriftState` or `readDriftState`.

**Legacy migration:** If `.drift-state` exists as a single file (old format, JSON or YAML), `readDriftState` transparently migrates it: parses the old file, writes per-node files, deletes the old file, and returns the state. Legacy string-hash entries are silently skipped during migration. This directory should be committed to the repository so drift baselines persist across sessions.

## Decisions

# IO Decisions

**Separation of I/O from domain:** Parsers and stores live in io/ so that cli/core (loader, drift-detector) and cli/commands can remain focused on domain logic. All filesystem access, YAML parsing, and operational state persistence are centralized here.

**Graceful degradation for operational files:** readDriftState returns empty structure on missing file — this is optional operational metadata. Parsers for config and graph structure throw on invalid input, since those are required for correct operation.

**Standard artifact injection in parseConfig:** After parsing user-defined artifacts, the config parser injects the three standard artifacts (responsibility.md, interface.md, internals.md) if they are not already present. Chose injection-as-safety-net over throwing-on-missing because the validator (E020) already reports the error — the parser ensures downstream code always sees a complete config regardless. User-defined values for standard artifacts are preserved (injection only fills gaps, never overwrites).
