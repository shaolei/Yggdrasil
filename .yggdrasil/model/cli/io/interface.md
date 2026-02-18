# IO Interface

Library used by cli/core and cli/commands. All paths are absolute (callers resolve from project root / yggRoot).

## config-parser.ts

- `parseConfig(filePath: string): Promise<YggConfig>`
  - Throws on missing name, invalid node_types, invalid artifacts. Returns parsed config with quality defaults.

## node-parser.ts

- `parseNodeYaml(filePath: string): Promise<NodeMeta>`
  - Throws on missing name/type, invalid relations, invalid mapping. Relations: uses, calls, extends, implements, emits, listens.

## aspect-parser, flow-parser, knowledge-parser, template-parser

- `parseAspect(dirPath, aspectYamlPath): Promise<AspectDef>`
- `parseFlow(dirPath, flowYamlPath): Promise<FlowDef>`
- `parseKnowledge(dirPath, knowledgeYamlPath, category, relativePath): Promise<KnowledgeItem>`
- `parseTemplate(filePath): Promise<TemplateDef>`

## artifact-reader.ts

- `readArtifacts(dirPath: string, excludeFiles?: string[]): Promise<Artifact[]>`
  - Reads all non-binary files except excludeFiles (default: node.yaml). Returns sorted by filename. Skips .png, .jpg, etc.

## drift-state-store.ts

- `readDriftState(yggRoot: string): Promise<DriftState>` — returns {} on missing file
- `writeDriftState(yggRoot: string, state: DriftState): Promise<void>`
- `getCanonicalHash(entry: string | DriftNodeState): string`
- `getFileHashes(entry): Record<string, string> | undefined`

## journal-store.ts

- `readJournal(yggRoot: string): Promise<JournalEntry[]>`
- `appendJournalEntry(yggRoot: string, note: string, target?: string): Promise<JournalEntry>`
- `archiveJournal(yggRoot: string): Promise<string | null>` — moves .journal.yaml to journals-archive/.journal.<datetime>.yaml, returns archive path or null if empty
