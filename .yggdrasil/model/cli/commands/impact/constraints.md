# Impact Command Constraints

- **Exactly one mode required:** The flags `--node`, `--aspect`, and `--flow` are mutually exclusive. Exactly one must be provided. Zero or more than one causes exit with error.
- **Simulation requires git history:** The `--simulate` flag calls `loadGraphFromRef` to compare HEAD baseline against the current working tree. This requires a git repository with at least one commit. If the ref cannot be resolved, the baseline comparison is skipped gracefully (returns null).
- **Node mode requires valid node path:** When `--node` is used, the path must exist in the graph. Missing nodes cause exit with error.
- **Aspect mode requires valid aspect id:** When `--aspect` is used, the id must match a loaded aspect. Missing aspects cause exit with error.
- **Flow mode requires valid flow name:** When `--flow` is used, the name must match a loaded flow (by name or path). Missing flows cause exit with error.
