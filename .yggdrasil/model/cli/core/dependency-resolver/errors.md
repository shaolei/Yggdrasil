# Dependency Resolver Errors

- **Cycle detected**: Throws on resolveDeps when structural relations form a cycle.
- **findChangedNodes**: Propagates git command errors (execSync). Returns [] on non-git or empty diff.
- **formatDependencyTree**: No throw; returns empty string if node unmapped.
