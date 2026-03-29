## Logic

# Graph Loader Logic

## loadGraph

1. findYggRoot(projectRoot) → yggRoot
2. parseConfig(yg-config.yaml) — on error: throw or set configError if tolerateInvalidConfig
3. scanModelDirectory(modelDir, modelDir, null, ...) — recursive scan
4. loadAspects(aspectsDir), loadFlows(flowsDir), loadSchemas(schemasDir)
5. Return Graph with nodes, aspects, flows, schemas, rootPath

## scanModelDirectory

- readdir; if no yg-node.yaml and dir !== modelDir → return (skip)
- If has yg-node.yaml: parseNodeYaml, readArtifacts (exclude yg-node.yaml, filter by STANDARD_ARTIFACTS keys)
- Build GraphNode with path, meta, artifacts, children, parent
- Recurse into subdirs; each subdir with yg-node.yaml becomes child

## loadAspects, loadFlows, loadSchemas

- **Aspects:** readdir category dir; for each item parse YAML, read artifacts. Returns `[]` on missing dir.
- **Flows:** readdir flows dir; for each item parse YAML, read artifacts. Returns `[]` only on missing dir; parse errors in individual flows propagate (unlike the previous behavior which silently swallowed all errors).
- **Schemas:** `loadSchemas(schemasDir)` readdir; for each `.yaml`/`.yml` call `parseSchema` (validates YAML, infers schemaType from filename). Returns `SchemaDef[]`. On missing dir or parse error returns `[]`.

## Decisions

# Loader Decisions

**tolerateInvalidConfig option:** The loader accepts an option to fall back to a minimal config when yg-config.yaml is broken. This enables partial graph loading for commands like `validate` that need to report config errors alongside other issues, rather than failing entirely at the config parse stage.

**Node parse errors collected, not thrown:** When scanning model directories, a broken yg-node.yaml is recorded in `nodeParseErrors` and scanning continues to the next directory. One malformed node should not prevent loading the rest of the graph. The validator reports these as E001 errors.

**loadGraphFromRef uses git archive + tar:** Extracting `.yggdrasil/` from a git ref uses `git archive` piped to `tar` in a temp directory. This avoids checking out the ref (which would modify the working tree) and works without a full worktree. The temp directory is cleaned up in a `finally` block regardless of success or failure.
