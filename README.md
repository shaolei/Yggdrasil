<div align="center">
  <img src="docs/public/logo.svg" alt="Yggdrasil" width="150" />
</div>

# Yggdrasil

**Make your repository self-aware.**
Persistent semantic memory and deterministic context assembly for AI agents.

[![CI](https://github.com/krzysztofdudek/Yggdrasil/actions/workflows/ci.yml/badge.svg)](https://github.com/krzysztofdudek/Yggdrasil/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@chrisdudek/yg.svg)](https://www.npmjs.com/package/@chrisdudek/yg)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![codecov](https://codecov.io/gh/krzysztofdudek/Yggdrasil/graph/badge.svg)](https://codecov.io/gh/krzysztofdudek/Yggdrasil)

---

## The problem

Conversation is ephemeral memory. Code is just the execution of decisions. Neither remembers _why_ things are the way they are, what constraints apply, or how components fit together.

When AI agents work on your codebase, they are forced to guess these rules — and guessing leads to bad outputs, broken architecture, and endless correction loops. Constraints that took you months to define vanish the moment the chat context window fills up.

## What Yggdrasil does

Yggdrasil gives your repository a **persistent semantic memory graph**.

It maintains the system's intent, rules, and boundaries in structured Markdown and YAML inside a `.yggdrasil/` directory. When an AI agent works on your code, Yggdrasil deterministically assembles a precise "context package" for the exact component the agent is modifying.

The agent stops guessing. It knows exactly what it is looking at, what constraints it must follow, and what the surrounding dependencies require.

### You change nothing about how you work

You use your AI agent exactly as you did before. Yggdrasil acts as an ambient, invisible infrastructure. Your agent reads the graph to understand the architecture, writes the code, and autonomously updates the graph in the background to reflect new decisions.

From the moment you install Yggdrasil, your repository becomes self-aware.

---

## Install

```bash
npm install -g @chrisdudek/yg
```

## Initialize

```bash
cd your-project
yg init --platform <platform>
```

Done. Your repository is now self-aware.

---

## Supported platforms

Yggdrasil natively configures behavioral rules for:

- Cursor
- Claude Code
- GitHub Copilot
- Cline / RooCode
- Codex
- Windsurf
- Aider
- Gemini CLI
- Amp

---

## What it is not

- ❌ **Not a code generator.** It is a semantic specification engine that makes your _existing_ agent generate perfect code.
- ❌ **Not manual documentation.** You don't have to write it. Your agent builds and maintains the graph naturally while working on your tasks.
- ❌ **Not locked to an AI provider.** The memory graph is just Markdown and YAML. It works with Cursor today, Claude Code tomorrow, and whatever comes next.
- ❌ **Not invasive.** Remove the `.yggdrasil/` folder at any time. Your project will work exactly as it did before.

---

## Documentation

Read the full specification and architectural concepts here:
[https://krzysztofdudek.github.io/Yggdrasil/](https://krzysztofdudek.github.io/Yggdrasil/)

---

## License

MIT — see [LICENSE](LICENSE)
