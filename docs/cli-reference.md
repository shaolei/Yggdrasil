---
title: CLI Reference
---

You do not need to run these commands in day-to-day use.
Your AI agent runs them automatically.

This page is for people who want to inspect or debug the repo's semantic memory.

---

## Setup

```bash
yg init [--platform <name>] [--upgrade]
```

Creates `.yggdrasil/` and installs the platform instruction file.

- `--platform <name>` — Agent platform (default: `generic`). Values: `cursor`, `claude-code`, `copilot`, `cline`, `roocode`, `codex`, `windsurf`, `aider`, `gemini`, `amp`, `generic`
- `--upgrade` — Refresh rules only when `.yggdrasil/` already exists

---

## Inspection

```bash
yg status
```

Summary: nodes, warnings, drift status.

```bash
yg tree [--root <path>] [--depth <n>]
```

Prints the full structure of the semantic memory.

- `--root <path>` — Show only subtree rooted at this path
- `--depth <n>` — Maximum depth

```bash
yg build-context --node <node-path> [--full]
yg build-context --file <file-path> [--full]
```

Shows the exact context package your agent reads before working on a node. Output is a
two-section YAML format: a structural map (topology, relationships, aspects, flows) followed
by an artifact registry (file paths). Default mode returns paths only — agents read files
individually using their file-reading tool.

- `--file <path>` — Resolves the owning node automatically, then assembles context. Prints
  owner mapping to stderr. Exits 1 if file has no graph coverage. Mutually exclusive with `--node`.
- `--full` — Appends artifact file contents below a `---` separator in XML-style tags, for
  environments without file reading capabilities

```bash
yg owner --file <path>
```

Finds which memory node owns a given file. Path is relative to repository root.
Quick ownership check — use `build-context --file` when you need the full context package.

```bash
yg deps --node <path> [--depth <n>] [--type <structural|event|all>]
```

Shows direct and transitive node dependencies.

- `--depth <n>` — Maximum depth for tree
- `--type <type>` — Relation filter: `structural`, `event`, `all` (default: `all`)

---

### `yg select`

Find graph nodes relevant to a task description using keyword matching.

```bash
yg select --task <description> [--limit <n>]
```

Uses weighted keyword matching against node artifacts (responsibility x3, interface x2,
aspects x2, others x1). Falls back to flow-based selection when no nodes match directly.

- `--task <description>` — Natural-language task description
- `--limit <n>` — Maximum nodes to return (default: 5)

Output: YAML list sorted by relevance score.

```yaml
- node: orders/order-service
  score: 12
  name: OrderService
```

---

### `yg preflight`

Unified diagnostic report combining drift, status, and validation.

```bash
yg preflight [--quick]
```

Outputs:

- **Drift** — nodes with source or graph drift (skipped with `--quick`)
- **Status** — node, aspect, flow, and mapping counts
- **Validation** — structural errors and completeness warnings

- `--quick` — Skip drift detection for faster results (useful for large repos)

Exit code 0 if fully clean, 1 if drift or validation errors found.

---

## Validation

```bash
yg validate [--scope <scope>]
```

Checks the memory for structural errors and quality warnings.
Exit code 1 on errors — useful as a CI merge gate.

- `--scope <scope>` — `all` or node-path; includes descendant nodes (default: `all`)

---

## Aspects

```bash
yg aspects
```

Lists all defined aspects with metadata.

Output: YAML format with fields: `id`, `name`, `description`, `implies`.

---

## Flows

```bash
yg flows
```

Lists all defined flows with metadata.

Output: YAML format with fields: `name`, `nodes` (participants), `aspects`.

---

## Drift detection

```bash
yg drift [--scope <scope>] [--drifted-only] [--limit <n>]
```

Detects source and graph drift — files that changed outside the semantic memory (source drift)
and graph artifacts that changed without a corresponding `drift-sync` (graph drift).

- `--scope <scope>` — `all` or node-path; includes descendant nodes (default: `all`)
- `--drifted-only` — Show only nodes with drift (hide ok entries)
- `--limit <n>` — Maximum entries to show per section (truncated sections show remaining count)

```bash
yg drift-sync --node <path> [--recursive]
yg drift-sync --all
```

Records current file hash after resolving drift.

- `--recursive` — Also sync all descendant nodes
- `--all` — Sync all nodes with mappings

---

## Impact analysis

```bash
yg impact --node <path> [--simulate]
yg impact --file <path> [--simulate]
yg impact --aspect <id> [--simulate]
yg impact --flow <name> [--simulate]
```

Shows the blast radius of changes to a node, aspect, or flow.
`--file` resolves the owning node automatically, then proceeds as `--node`.

- `--node` — Show reverse dependencies, descendants, structural dependents of descendants, flows, aspects, and co-aspect nodes
- `--aspect` — Show all nodes where this aspect is effective (own, hierarchy, flow, or implied), plus structural dependents of affected nodes
- `--flow` — Show all participants and their descendants, plus structural dependents of participants
- `--simulate` — Simulate context package impact (compare HEAD vs current)

Exactly one of `--node`, `--aspect`, or `--flow` is required.
