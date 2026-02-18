# Utils Responsibility

Shared helper functions used by CLI modules.

**In scope:**

- paths: findYggRoot (searches upward from cwd; throws if .yggdrasil exists but is not a directory), normalizeMappingPaths, normalizeProjectRelativePath, getPackageRoot, toGraphPath
- hash: file hash computation (for drift)
- tokens: estimateTokens — token count estimation for context budget
- git: getLastCommitTimestamp — Unix timestamp of last commit touching a path (for W008 stale-knowledge Proxy)

**Out of scope:**

- Business logic (cli/core, cli/commands)
