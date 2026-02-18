# @chrisdudek/yg

Yggdrasil — architectural knowledge infrastructure for AI agents.

`yg` is a deterministic CLI that adds a graph layer (`.yggdrasil/`) between
requirements and code. Instead of searching thousands of files, AI agents can
work with bounded context built from nodes, relations, constraints, and
artifacts.

No API keys. No network dependency. Just local files, validation, and context
builds.

## Installation

```bash
npm install -g @chrisdudek/yg
```

Requirements: Node.js 22+

## Quick Start

```bash
yg init --platform cursor
yg tree --depth 1
yg validate
yg build-context --node orders/order-service
```

## Core Commands

**Reading and analysis:**

- `yg build-context --node <path>` — Assemble context package for a node
- `yg status` — Graph health summary
- `yg tree [--root <path>] [--depth N]` — Graph structure as tree
- `yg owner --file <path>` — Find which graph node owns a source file
- `yg deps --node <path>` — Forward dependency tree and materialization order
- `yg impact --node <path> [--simulate]` — Reverse dependencies and context impact

**Validation and drift:**

- `yg validate [--scope all|node-path]` — Structural integrity and completeness
- `yg drift [--scope all|node-path]` — Detect graph-to-file divergence
- `yg drift-sync --node <path>` — Record current file hash after resolving drift

**Session journal:**

- `yg journal-add --note "..." [--target <node-path>]` — Buffer a decision note
- `yg journal-read` — List pending journal entries
- `yg journal-archive` — Archive journal after consolidation

**Setup:**

- `yg init --platform <name>` — Initialize `.yggdrasil/` structure (once per repository)

Node paths are relative to `.yggdrasil/model/`. File paths are relative to the
repository root.

## Supported Platforms

| Platform    | Init                             | Rules location                    |
| ----------- | -------------------------------- | --------------------------------- |
| Cursor      | `yg init --platform cursor`      | `.cursor/rules/yggdrasil.mdc`     |
| Claude Code | `yg init --platform claude-code` | `AGENTS.md` (Yggdrasil section)   |
| Copilot     | `yg init --platform copilot`     | `.github/copilot-instructions.md` |
| Generic     | `yg init --platform generic`     | `.yggdrasil/agent-rules.md`       |

## License

MIT
