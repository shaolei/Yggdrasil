---
title: Configuration
---

Everything here is optional except the fields required by the schema.
Yggdrasil works out of the box with sensible defaults.

Config file: `.yggdrasil/yg-config.yaml`

---

## Schema

### Required fields

- **name** — Project identity (non-empty string)
- **node_types** — Non-empty object of node type definitions. Each key is a type name, value is `{ description, required_aspects? }`. `description` is required agent guidance. `required_aspects` lists aspects that nodes of this type must have coverage for (directly or via aspect `implies`).

### Optional fields

- **version** — CLI version that last wrote this config. Set automatically by `yg init` and
  `yg init --upgrade`.
- **quality** — Quality thresholds

---

## What you can customize

- **Node types** — The vocabulary of parts your repo uses (e.g. `module`, `service`, `library`). Each type has a `description` (agent guidance) and optionally `required_aspects` — aspects that nodes of that type must have coverage for (directly or via aspect composition).
- **Quality thresholds** — When to warn about shallow memory or large context

The three standard artifacts (`responsibility.md`, `interface.md`, `internals.md`) are built into the CLI and cannot be configured. `responsibility.md` is always required, `interface.md` is required when a node has consumers, and `internals.md` is always optional.

---

## Quality config

| Field | Default | Description |
|-------|---------|-------------|
| `min_artifact_length` | 50 | Minimum chars for artifact content (shallow warning) |
| `max_direct_relations` | 10 | Max relations before high fan-out warning |
| `context_budget.warning` | 10000 | Token count warning threshold |
| `context_budget.error` | 20000 | Token count error threshold |

---

## Example

```yaml
name: my-repo

node_types:
  module:
    description: "Business logic unit with clear domain responsibility"
  service:
    description: "Component providing functionality to other nodes"
  library:
    description: "Shared utility code with no domain knowledge"

quality:
  min_artifact_length: 50
  max_direct_relations: 10
  context_budget:
    warning: 10000
    error: 20000
```

---

## Notes

- Artifact name `yg-node.yaml` is reserved.
- `yg-config.yaml: quality.context_budget.error` must be >= `context_budget.warning`.
