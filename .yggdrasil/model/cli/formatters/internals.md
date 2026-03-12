## Constraints

# Formatters Constraints

- **Primary output format is YAML:** `formatContextYaml` converts a `ContextMapOutput` to YAML with structured keys (meta, project, node, hierarchy, dependencies, artifacts). Empty optional sections are omitted.
- **Full content format uses XML-style tags:** `formatFullContent` wraps each file's content in `<path>...</path>` tags, separated from YAML by `---`.
- **Formatters are pure functions:** They receive structured data and return strings. No I/O, no validation, no graph modification.
- **Deterministic output:** YAML keys appear in declaration order. `lineWidth: 0` prevents line wrapping.

## Decisions

# Formatters Decisions

**Pure transformation:** Formatters perform no I/O and no validation. They receive structured data and produce text. This keeps the layer deterministic and testable — callers own input validity.

**YAML over XML:** Chose YAML context map output over the previous XML-like tag format because YAML is more readable for agents and easier to parse programmatically. The old `formatContextText` (XML tags) was removed as dead code after the v2 format switch.
