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
yg build-context --node <node-path>
```

Shows the exact context package your agent reads before working on a node (plain text with
XML-like tags).

```bash
yg owner --file <path>
```

Finds which memory node owns a given file. Path is relative to repository root.

```bash
yg deps --node <path> [--depth <n>] [--type <structural|event|all>]
```

Shows direct and transitive node dependencies.

- `--depth <n>` — Maximum depth for tree
- `--type <type>` — Relation filter: `structural`, `event`, `all` (default: `all`)

---

## Validation

```bash
yg validate [--scope <scope>]
```

Checks the memory for structural errors and quality warnings.
Exit code 1 on errors — useful as a CI merge gate.

- `--scope <scope>` — `all` or node-path (default: `all`)

---

## Drift detection

```bash
yg drift [--scope <scope>]
```

Detects files that changed outside the semantic memory.

- `--scope <scope>` — `all` or node-path (default: `all`)

```bash
yg drift-sync --node <path>
```

Records current file hash after resolving drift.

---

## Impact analysis

```bash
yg impact --node <path> [--simulate]
```

Shows what depends on a node and how changes would propagate.

- `--simulate` — Simulate context package impact (compare HEAD vs current)

---

## Journal

```bash
yg journal-add --note <text> [--target <node-path>]
```

Adds a note to the session journal.

```bash
yg journal-read
```

Lists pending journal entries.

```bash
yg journal-archive
```

Archives journal after consolidating notes to graph.
