# Model Interface

Type library — exports TypeScript interfaces and types only. No runtime functions. Used by cli/core, cli/io, cli/commands, cli/formatters.

**Key types:**

- `YggConfig`, `ArtifactConfig`, `QualityConfig`, `KnowledgeCategory`
- `Graph`, `GraphNode`, `NodeMeta`, `Relation`, `RelationType`, `NodeMapping`
- `AspectDef`, `FlowDef`, `KnowledgeItem`
- `ContextPackage`, `ContextLayer`, `ContextSection`, `ContextSectionKey`
- `ValidationResult`, `ValidationIssue`, `IssueSeverity`
- `DriftReport`, `DriftEntry`, `DriftStatus`, `DriftState`, `DriftNodeState`
- `JournalEntry`
- `Stage` (for resolveDeps)
- `OwnerResult`

RelationType: 'uses' | 'calls' | 'extends' | 'implements' | 'emits' | 'listens'.

NodeMapping: { type: 'file'|'directory'|'files', path?: string, paths?: string[] }.
