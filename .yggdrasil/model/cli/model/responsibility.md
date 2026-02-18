# Model Responsibility

TypeScript type definitions for the graph and operations on it.

**In scope:**

- YggConfig, ArtifactConfig (required, description, structural_context), QualityConfig
- GraphNode, NodeMeta, Relation, NodeMapping
- AspectDef, FlowDef, KnowledgeItem
- Graph (with optional nodeParseErrors for parse failures)
- ContextPackage, ContextLayer, ContextSection (ContextSectionKey: Global, Knowledge, Hierarchy, OwnArtifacts, Dependencies, Aspects, Flows)
- ValidationResult, ValidationIssue
- DriftReport, DriftEntry, DriftState
- JournalEntry

**Out of scope:**

- Parsing implementation (cli/io)
- Validation logic (cli/core)
