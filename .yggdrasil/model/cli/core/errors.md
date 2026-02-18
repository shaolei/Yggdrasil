# Core Errors

- **Node not found**: `buildContext` throws when node does not exist
- **Broken relation**: throws when relation target does not exist in graph
- **Invalid config**: `loadGraph` may use fallback config with tolerateInvalidConfig
- **Parsing errors**: propagated from io (YAML error, missing fields)
