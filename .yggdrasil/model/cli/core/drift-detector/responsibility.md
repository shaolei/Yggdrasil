# Drift Detector Responsibility

Compares current file hashes with .drift-state. States: ok, drift, missing, unmaterialized.

**In scope:**

- Hash strategy: file = SHA-256 content; directory = SHA-256 of sorted (path, hash) pairs; .gitignore excluded.
- Per-node filtering via filterNodePath.

**Out of scope:**

- Drift state storage (cli/io)
- Dependency resolution (cli/core/dependency-resolver)
