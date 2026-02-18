# Core Responsibility

Graph logic module — loading, context building, validation, drift detection, dependency resolution. Implements deterministic algorithms from docs/idea/engine.md.

**Sub-nodes:**

- **cli/core/loader**: loadGraph, loadGraphFromRef
- **cli/core/context**: buildContext
- **cli/core/validator**: validate
- **cli/core/drift-detector**: detectDrift
- **cli/core/dependency-resolver**: resolveDeps, formatDependencyTree, findChangedNodes

**Out of scope:**

- YAML parsing (cli/io)
- Output formatting (cli/formatters)
- Type definitions (cli/model)
