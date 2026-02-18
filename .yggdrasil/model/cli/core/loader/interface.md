# Graph Loader Interface

- `loadGraph(projectRoot: string, options?: { tolerateInvalidConfig?: boolean }): Promise<Graph>`
  - Finds .yggdrasil/ via findYggRoot. Parses config; on failure uses FALLBACK_CONFIG if tolerateInvalidConfig. Scans model/, loads aspects/, flows/, knowledge/, templates/. Returns Graph with rootPath, nodes, aspects, flows, knowledge, templates, config, configError, nodeParseErrors (optional).

- `loadGraphFromRef(projectRoot: string, ref?: string): Promise<Graph | null>`
  - Extracts .yggdrasil from git ref to temp dir, loads graph. Returns null if not git repo or ref missing.
