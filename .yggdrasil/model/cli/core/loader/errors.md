# Graph Loader Errors

- **Directory .yggdrasil/model/ does not exist**: Thrown when model/ is missing (ENOENT). Run `yg init` first.
- **Config parse failure**: Propagated unless `tolerateInvalidConfig`; then FALLBACK_CONFIG used, configError set on Graph.
- **loadGraphFromRef**: Returns null if not a git repo, ref missing, or .yggdrasil not in ref. No throw.
