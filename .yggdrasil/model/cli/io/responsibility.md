# IO Responsibility

I/O layer — parsing graph files and persisting operational state.

**In scope:**

- config-parser: parse config.yaml. Enforces: knowledge_categories required (may be []); artifacts non-empty; required.when one of has_incoming_relations, has_outgoing_relations, has_tag:<name>; structural_context optional boolean per artifact
- node-parser, aspect-parser, flow-parser, knowledge-parser, template-parser: parse YAML for nodes and graph elements
- artifact-reader: read .md artifact files
- drift-state-store: read/write .drift-state
- journal-store: read/write .journal.yaml

**Out of scope:**

- Validation logic (cli/core)
- Type definitions (cli/model)
