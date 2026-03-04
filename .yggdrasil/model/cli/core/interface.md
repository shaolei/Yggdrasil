## Failure Modes

Core functions signal errors by throwing. Callers (commands) catch and present.

- **Node not found**: `buildContext` throws when the requested node does not exist in the graph
- **Broken relation**: `buildContext` throws when a relation target does not exist in the graph; `validate` reports as E004
- **Dependency cycle**: `resolveDeps` throws when structural relations form a cycle (unless all cycle members are blackbox nodes)
- **Context budget exceeded**: `buildContext` exits with error when assembled context exceeds the configured token budget — signals the node should be split
- **Invalid config**: `loadGraph` may use fallback config with tolerateInvalidConfig flag
- **Parsing errors**: propagated from io layer (YAML syntax errors, missing required fields)
