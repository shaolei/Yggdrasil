# Graph Loader Responsibility

Loads the graph from `.yggdrasil/` — model nodes, aspects, flows, knowledge, templates. Git integration for loading graph from a ref.

**In scope:**

- **graph-loader.ts**: Scan `model/` recursively for node.yaml; load aspects, flows, knowledge by config.knowledge_categories, load templates. Throws when model/ does not exist. Uses FALLBACK_CONFIG when config parse fails and tolerateInvalidConfig. Records parse errors to nodeParseErrors (E001).
- **graph-from-git.ts**: `loadGraphFromRef(projectRoot, ref)` — extract .yggdrasil from git archive to temp dir. Returns null if not a git repo or ref missing.

**Out of scope:**

- YAML parsing (cli/io)
- Context building (cli/core/context)
- Validation (cli/core/validator)
