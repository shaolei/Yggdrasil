# Loader Decisions

**tolerateInvalidConfig option:** The loader accepts an option to fall back to a minimal config when config.yaml is broken. This enables partial graph loading for commands like `validate` that need to report config errors alongside other issues, rather than failing entirely at the config parse stage.

**Node parse errors collected, not thrown:** When scanning model directories, a broken node.yaml is recorded in `nodeParseErrors` and scanning continues to the next directory. One malformed node should not prevent loading the rest of the graph. The validator reports these as E001 errors.

**loadGraphFromRef uses git archive + tar:** Extracting `.yggdrasil/` from a git ref uses `git archive` piped to `tar` in a temp directory. This avoids checking out the ref (which would modify the working tree) and works without a full worktree. The temp directory is cleaned up in a `finally` block regardless of success or failure.
