# CLI Module Responsibility

The CLI module covers the `@chrisdudek/yg` package — a deterministic command-line tool for Yggdrasil's architectural knowledge infrastructure. Reference: docs/idea/foundation.md, engine.md, tools.md.

**In scope:**

- Registering and executing 13 commands: init, build-context, validate, drift, drift-sync, status, tree, owner, deps, impact, journal-add, journal-read, journal-archive
- Loading the graph from `.yggdrasil/` (config, model, aspects, flows, schemas)
- Building context packages per the 5-step algorithm (docs/idea/engine.md)
- Validating structural integrity and completeness signals
- Detecting drift between graph mappings and file hashes (SHA-256)
- Managing the session journal (buffer between conversation and graph)
- Resolving dependency order for materialization (topological sort of structural relations)

**Out of scope:**

- User-domain business logic (the graph is generic)
- Integration with external APIs or network services
- Writing to graph files (model, aspects, flows) — tools read and validate only; agent writes
- Capturing user intent (specify/clarify/plan) — that is process tooling, not this CLI

**Invariant:** Tools never write node.yaml or artifacts. Exception: init creates bootstrap structure; drift-sync writes .drift-state; journal commands write .journal.yaml.
