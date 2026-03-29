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
- **artifacts** — Non-empty object defining artifact types and their requirements. The three standard artifacts (`responsibility.md`, `interface.md`, `internals.md`) are always required and injected automatically if missing from config. Custom artifacts are additive.

### Optional fields

- **version** — CLI version that last wrote this config. Set automatically by `yg init` and
  `yg init --upgrade`.
- **quality** — Quality thresholds

---

## What you can customize

- **Node types** — The vocabulary of parts your repo uses (e.g. `module`, `service`, `library`). Each type has a `description` (agent guidance) and optionally `required_aspects` — aspects that nodes of that type must have coverage for (directly or via aspect composition).
- **Artifacts** — The kinds of meaning you want to capture per node. Three standard artifacts are always present and cannot be removed: `responsibility.md` (always required), `interface.md` (required when node has consumers), and `internals.md` (optional). Projects can add custom artifacts on top of these. Each artifact has:
  - `required`: `always` | `never` | `{ when: "<condition>" }`
    - Supported `when` conditions: `has_incoming_relations`, `has_outgoing_relations`, `has_aspect:<name>` (legacy `has_tag:<name>` also accepted)
  - `description`: string
  - `included_in_relations`: boolean — When `true`, this artifact is included in the context package of dependent nodes (via structural relations like uses, calls, extends, implements). Default artifacts with this flag: `responsibility.md`, `interface.md`.
- **Quality thresholds** — When to warn about shallow memory or large context

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

artifacts:
  responsibility.md:
    required: always
    description: "What this node is responsible for, and what it is not"
    included_in_relations: true
  interface.md:
    required:
      when: has_incoming_relations
    description: "Public API — methods, parameters, return types, contracts"
    included_in_relations: true
  logic.md:
    required: never
    description: "Algorithmic flow, control flow, branching logic, decision trees"
  constraints.md:
    required: never
    description: "Validation rules, business rules, invariants"
    included_in_relations: true
  errors.md:
    required:
      when: has_incoming_relations
    description: "Failure modes, edge cases, error conditions, recovery behavior"
    included_in_relations: true
  model.md:
    required: never
    description: "Data structures, schemas, entities, type definitions"
  state.md:
    required: never
    description: "State machines, lifecycle, transitions"
  decisions.md:
    required: never
    description: "Local design decisions and rationale"

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
