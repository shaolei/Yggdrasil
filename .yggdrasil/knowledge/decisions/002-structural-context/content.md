# Structural Context for Relational Layers

## Context

When building a context package for a node, the context-builder includes layers from structural relations (uses, calls, extends, implements). Each relation layer pulls artifacts from the target node. Without guidance, all configured artifacts would be included, which can bloat the context.

## Decision

Artifacts can declare `structural_context: true` in config. When building a relational layer, the context-builder prefers artifacts with `structural_context: true` over the full artifact set. If none match, it falls back to all configured artifacts.

By default, `interface` and `errors` have `structural_context: true`. These are the minimal artifacts needed for a consumer to understand the dependency's API and failure modes.

## Rationale

- **Token economy:** Limiting relational layers to interface + errors keeps context packages smaller.
- **Sufficient for consumers:** A consumer needs the target's public API and error behavior, not its full responsibility or internal decisions.
- **Configurable:** Repos can override per artifact; `structural_context` is optional.

## Implementation

- `context-builder.ts`: `buildStructuralRelationLayer` reads `config.artifacts[].structural_context` and filters target artifacts accordingly.
- `default-config.ts`: Sets `structural_context: true` for interface and errors in the generated init template.
