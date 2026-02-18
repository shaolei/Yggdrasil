# Context Builder Errors

- **Node not found**: Throws if nodePath not in graph.
- **Broken relation**: Throws if relation target not in graph.
- **Artifact read failure**: Propagated from readFile (ENOENT, etc.).
