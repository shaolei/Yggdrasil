<div align="center">
  <img src="docs/public/logo.svg" alt="Yggdrasil" width="150" />
</div>

# Yggdrasil

**Make your repository self-aware.**
Your AI agent forgets everything between sessions. Yggdrasil makes it remember.

[![CI](https://github.com/krzysztofdudek/Yggdrasil/actions/workflows/ci.yml/badge.svg)](https://github.com/krzysztofdudek/Yggdrasil/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@chrisdudek/yg.svg)](https://www.npmjs.com/package/@chrisdudek/yg)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![codecov](https://codecov.io/gh/krzysztofdudek/Yggdrasil/graph/badge.svg)](https://codecov.io/gh/krzysztofdudek/Yggdrasil)

---

## The problem you already know

Your AI agent works great on small projects. 20 files, no problem.

Then your project grows. 200 files. The agent starts breaking things. It rewrites your auth module because it doesn't know about the rate limiting middleware. It ignores your error handling conventions because they live in a file it never read. It creates a second implementation of something that already exists.

You explain the rules. The agent follows them for one session. Next session, it's back to guessing.

The issue isn't intelligence. It's memory. The agent has none.

## What Yggdrasil does

Yggdrasil gives your repository a persistent memory. Not a chat log. Not a giant rules file. A structured map of your system: what each part does, what depends on what, what rules apply, and why things are the way they are.

When your agent works on a file, Yggdrasil gives it exactly the context it needs for that specific part. Not 200,000 tokens of "here's the whole repo." Just the 2,000-5,000 tokens that actually matter.

Your agent maintains this memory as it works. You don't write documentation. Your agent does it in the background while writing code.

## The 5-minute version

**Without Yggdrasil:**
```
You: "Add a payment retry to OrderService"
Agent: reads OrderService.ts, maybe PaymentService.ts
       doesn't know about the rate limiting middleware
       doesn't know orders must have min 1 item
       doesn't know you chose event sourcing over direct DB writes
       guesses. breaks things. you correct. repeat.
```

**With Yggdrasil:**
```
You: "Add a payment retry to OrderService"
Agent: reads the context package for OrderService (auto-assembled)
       knows: calls PaymentService.charge and .refund
       knows: rate limiting middleware applies (aspect)
       knows: event sourcing pattern (long-term memory)
       knows: order validation rules (constraints)
       implements correctly. updates the memory graph. done.
```

The context package is assembled automatically. You don't build it. You don't maintain it. Your agent does.

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

That's it. Your agent now has persistent memory.

---

## Supported platforms

Cursor, Claude Code, GitHub Copilot, Cline / RooCode, Codex, Windsurf, Aider, Gemini CLI, Amp.

---

## Does it actually work?

I ran 4 series of experiments (22 experiments total) using Claude Code on real open-source codebases: Hoppscotch, Medusa, Django.

**What I can say with confidence:**

- An agent given only a context package (no source code access) implemented a new service correctly. Score: 4.93/5.00 across 3 nodes. The core promise works.
- Starting with a minimal graph and iterating takes 2 cycles to reach quality (1.2 → 3.5 → 4.9 out of 5). You don't need a perfect graph upfront.
- Impact analysis catches 100% of affected components within the mapped graph.
- 4 well-chosen nodes capture 92% of the quality of a full graph. You don't need to map everything.

**What I'm honest about:**

- These experiments were run and scored by the same AI agent. No independent peer review. Take the exact numbers as directional, not absolute.
- Most experiments used one codebase (Hoppscotch). Results may differ on very different architectures.
- The graph doesn't catch what it doesn't know. Missing information is a bigger problem than wrong information, because agents trust the graph and stop looking further.

Full experiment reports are in the repo: `experiments/`.

---

## How it works (short version)

1. You run `yg init`. A `.yggdrasil/` directory appears in your project.
2. Your agent starts building a knowledge graph as it works. Nodes describe modules, services, and components. Each node has artifacts: what it does, its interface, its constraints, its decisions.
3. When the agent needs to modify a file, it runs `yg build-context` and gets a context package: a compact document with everything it needs to know about that specific part of the system.
4. The agent writes code and updates the graph in the same step. Memory stays in sync with reality.

Everything is plain Markdown and YAML. No database. No vendor lock-in. Remove the `.yggdrasil/` folder and your project works exactly as before.

---

## What it is not

- **Not a code generator.** Your existing agent generates code. Yggdrasil makes it generate better code by giving it the right context.
- **Not manual documentation.** You don't write it. Your agent builds and maintains the graph while working on your tasks.
- **Not locked to a provider.** It's Markdown and YAML. Works with Cursor today, Claude Code tomorrow, whatever comes next.
- **Not invasive.** Delete `.yggdrasil/` at any time. Nothing else changes.

---

## When is it worth it?

**Worth it:**
- Your project has 100+ files and your agent keeps making the same mistakes
- Multiple people (or agents) work on the codebase and context gets lost between them
- You're tired of re-explaining the same architectural decisions every session

**Not worth it (yet):**
- Small projects where the agent can see everything at once
- Solo scripts or utilities with no cross-module dependencies
- You're prototyping and architecture doesn't matter yet

---

## Documentation

Full specification and architecture:
[https://krzysztofdudek.github.io/Yggdrasil/](https://krzysztofdudek.github.io/Yggdrasil/)

---

## License

MIT — see [LICENSE](LICENSE)
