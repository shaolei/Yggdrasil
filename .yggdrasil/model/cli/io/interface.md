# IO Interface

Library used by cli/core (loader, drift-detector) and cli/commands (journal). All paths are absolute; callers resolve from project root or yggRoot.

## config-parser.ts

- `parseConfig(filePath: string): Promise<YggConfig>`
  - Reads and parses config.yaml. Throws on missing name, invalid node_types, invalid artifacts (reserved name `node`, invalid required.when), invalid quality (context_budget.error < warning). Returns parsed config with quality defaults.

## node-parser.ts

- `parseNodeYaml(filePath: string): Promise<NodeMeta>`
  - Throws on missing name/type, invalid relations (non-array, invalid type, missing target), invalid mapping (paths must be relative, non-empty), invalid aspect_exceptions (non-array, missing aspect/note, aspect not in node's aspects list), invalid anchors (must be object mapping aspect ids to non-empty arrays of strings). Relation types: uses, calls, extends, implements, emits, listens.
  - Internally calls `parseAspectExceptions(raw, aspects, filePath)` which validates each entry has non-empty `aspect` and `note` strings, and that `aspect` references an id present in the node's `aspects` array. Returns `AspectException[]` or undefined.
  - Internally calls `parseAnchors(raw, filePath)` which validates anchors as `Record<string, string[]>` — must be an object (not array), each value must be a non-empty array of strings. Empty objects become undefined. Returns `Record<string, string[]>` or undefined.

## aspect-parser.ts

- `parseAspect(aspectDir: string, aspectYamlPath: string, id: string): Promise<AspectDef>`
  - Throws on missing name or empty id. Parses optional `stability` (must be one of: schema, protocol, implementation). Reads artifacts from aspectDir excluding aspect.yaml.

## flow-parser.ts

- `parseFlow(flowDir: string, flowYamlPath: string): Promise<FlowDef>`
  - Throws on missing name, invalid or empty nodes array. Reads artifacts from flowDir excluding flow.yaml. Sets `path` from `flowDir` basename (directory name under flows/).

## schema-parser.ts

- `parseSchema(filePath: string): Promise<SchemaDef>`
  - Validates file is parseable YAML. Infers `schemaType` from filename stem (e.g. `node.yaml` → `'node'`). Used by `loadSchemas` in cli/core/loader.

## artifact-reader.ts

- `readArtifacts(dirPath: string, excludeFiles?: string[], includeFiles?: string[]): Promise<Artifact[]>`
  - excludeFiles default: `['node.yaml']`. If includeFiles provided, only those files included. Returns sorted by filename. Skips non-files.

## drift-state-store.ts

- `readDriftState(yggRoot: string): Promise<DriftState>` — returns `{}` on missing file or parse error
- `writeDriftState(yggRoot: string, state: DriftState): Promise<void>`
- `getCanonicalHash(entry: string | DriftNodeState): string` — returns string hash or entry.hash
- `getFileHashes(entry: string | DriftNodeState): Record<string, string> | undefined` — returns entry.files or undefined

## journal-store.ts

- `readJournal(yggRoot: string): Promise<JournalEntry[]>` — returns `[]` on missing file or parse error
- `appendJournalEntry(yggRoot: string, note: string, target?: string): Promise<JournalEntry>` — appends with ISO timestamp
- `archiveJournal(yggRoot: string): Promise<{ archiveName: string; entryCount: number } | null>` — moves .journal.yaml to journals-archive/.journal.YYYYMMDD-HHMMSS.yaml; returns null if empty or missing

## Failure Modes

Parsers and stores throw `Error` on invalid input. No dedicated error codes — standard Error with descriptive message.

**config-parser:** Missing name, invalid node_types, invalid artifacts (reserved name `node`, invalid required.when), invalid quality (context_budget.error < warning). Propagates ENOENT, EACCES from readFile.

**node-parser:** Missing name/type, invalid relations (non-array, invalid type, missing target), invalid mapping (paths must be relative, non-empty, no leading slash), invalid aspect_exceptions (non-array, entries without aspect/note, aspect id not in node's aspects list), invalid anchors (not an object, values not non-empty arrays of strings). Propagates ENOENT, EACCES from readFile.

**aspect-parser:** Missing name or empty id. Invalid `stability` (not one of: schema, protocol, implementation). Propagates readFile and readArtifacts errors.

**flow-parser:** Missing name, invalid or empty nodes array. Propagates readFile and readArtifacts errors.

**schema-parser:** Invalid YAML (parseSchema). Propagates ENOENT, EACCES from readFile.

**artifact-reader:** Propagates ENOENT, EACCES from readdir/readFile.

**drift-state-store, journal-store:** ENOENT on read is handled gracefully (return {} or []). Write failures propagate (ENOENT, EACCES). archiveJournal returns null on missing/empty journal.
