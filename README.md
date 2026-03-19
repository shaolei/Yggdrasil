<div align="center">
  <img src="docs/public/logo.svg" alt="Yggdrasil" width="150" />
</div>

# Yggdrasil

## Stop re-explaining your codebase to your AI agent


https://github.com/user-attachments/assets/49c8fe8f-c3b9-4202-b655-7f987dcab4cb


AI agents keep forgetting your architecture, constraints, and past decisions. Yggdrasil gives your repository persistent semantic memory, so each task starts with the right context instead of another giant prompt.

[![CI](https://github.com/krzysztofdudek/Yggdrasil/actions/workflows/ci.yml/badge.svg)](https://github.com/krzysztofdudek/Yggdrasil/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@chrisdudek/yg.svg)](https://www.npmjs.com/package/@chrisdudek/yg)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![codecov](https://codecov.io/gh/krzysztofdudek/Yggdrasil/graph/badge.svg)](https://codecov.io/gh/krzysztofdudek/Yggdrasil)

***

## 📦 Install

```bash
npm install -g @chrisdudek/yg
```

## 🚀 Initialize

```bash
cd your-project
yg init --platform <platform>
```

That is it. Your agent now has persistent semantic memory.

***

## ⚙️ How it works

1. You run `yg init` in your project.
2. A `.yggdrasil` folder appears in the repo.
3. As your agent works, it builds and updates semantic memory about the system.
4. Before changing a file, it asks for relevant context.
5. Yggdrasil returns a short, bounded context package for that exact area.
6. The agent writes code and updates memory in the same step.

The memory is stored as plain Markdown and YAML.

No database.
No lock-in.
No hidden black box.

Delete `.yggdrasil` and your project works exactly as before.

***

## 💡 Why this exists

Every new AI coding task starts the same way.

You explain how the system works.
What must not break.
Why this module exists.
Which rules apply here.
What happened last time this went wrong.

Then the session ends.

And the next time, you do it all over again.

That works on small projects.

On real codebases, it turns into context tax.

The agent reads a few files, misses the bigger picture, guesses, and makes changes that look reasonable but break neighboring contracts. You fix it. You explain more. You add another rule. You paste another prompt. Repeat.

The problem is not just model quality.

The problem is memory.

***

## ✅ What you get

Yggdrasil gives your repository persistent semantic memory.

Instead of dumping the whole repo into a prompt, it gives the agent the exact context needed for the part of the system it is changing.

That means:

- 🔁 Less re-explaining the same architecture over and over.
- 🛡️ Fewer broken edits caused by missing context.
- 📉 Less prompt bloat and fewer giant rules files.
- 📈 Better AI-assisted changes on medium and large codebases.
- 🧠 Architectural knowledge that survives between sessions, people, and tools.

***

## 🧩 Building blocks

Yggdrasil organizes knowledge into a few simple building blocks.

**🌳 Nodes** are the core units. They form a tree — parent nodes provide domain context, children inherit it. A node can map to a single file, a directory, or a group of files. Not every node maps 1:1 to a file — you choose the granularity that makes sense.

**🔗 Relations** connect nodes. They describe which parts of the system depend on each other, what is consumed, and what happens when a dependency fails.

**🌊 Flows** describe business processes that span multiple nodes. "Customer checks out an order" is a flow — it touches orders, payments, inventory, notifications. Without flows, this end-to-end knowledge lives in no single file and gets lost between sessions.

**🔷 Aspects** capture cross-cutting requirements: audit logging, rate limiting, authentication, idempotency — rules that apply across many parts of the system. Instead of repeating "this area must emit audit events" in every node, you define it once as an aspect and apply it where it belongs.

Together, these give the agent a structured map of your system — not just files, but meaning.

***

## 🌱 How knowledge grows

Yggdrasil is not a scanner that indexes your code automatically. The knowledge it holds is built through your conversations with the agent.

**This is a deliberate design choice.** Automatically extracted information is shallow — function signatures, file lists, import graphs. The knowledge that actually prevents broken changes is deeper: *why* this module exists, *what* must never break, *which* business rules apply here, *what* was tried before and rejected. That kind of knowledge comes from you.

Here is what this looks like in practice:

- You start working on a module. The agent creates nodes, maps files, writes down responsibilities.
- You mention a business rule — the agent captures it in an aspect.
- You describe a process — the agent creates a flow.
- You explain why a design decision was made — the agent records it, including what was rejected and why.

Each conversation makes the graph richer. After a few sessions, the agent stops asking the same questions — the answers are already in the graph.

**The more you direct the work, the faster knowledge accumulates:**

- 🎯 Point the agent at a specific module and ask it to map the area.
- 🔍 Ask it to identify cross-cutting patterns and create aspects.
- 🔄 Ask it to trace a business process end-to-end and create a flow.
- 📐 When the agent produces a bad output, ask what was missing in the graph — then fix the graph, not just the code.

This is conscious work. It takes effort. But the investment compounds — every piece of knowledge captured is knowledge you will never have to explain again. To any agent, in any tool, in any future session.

***

## 🔍 One example

You ask the agent to add a payment retry to `OrderService`.

Without Yggdrasil, it may read `OrderService.ts`, maybe `PaymentService.ts`, and still miss that:

- rate limiting rules apply here,
- orders must always have at least one item,
- this area uses event sourcing,
- the current interface exists because of an earlier production issue.

So it guesses.

It makes a change that looks plausible.

It breaks things.

With Yggdrasil, the agent gets focused context for that exact area before it touches the file.

It knows:

- what this module is responsible for,
- what depends on it,
- which constraints apply here,
- why the current design exists,
- what else may break if this change is wrong.

That is the difference between code generation and context-aware change.

***

## 🗄️ What Yggdrasil actually stores

Yggdrasil helps agents work with more than raw files.

It stores and serves knowledge like:

- module responsibilities,
- interfaces and constraints,
- dependencies between parts of the system,
- cross-cutting rules,
- important architectural decisions,
- what may be affected by a change.

In other words, not just what the code does.

Also why it exists and what must not break.

***

## 🧭 Why this matters

Code contains logic.

It does not reliably contain meaning.

A human can survive that gap. A human can ask around, read between the lines, and slowly rebuild a mental model of the system.

An AI agent cannot.

That is why agents often look great on small repos and unreliable on larger ones.

Repositories already have memory of changes through Git.

What they usually do not have is memory of meaning in a form agents can use.

Yggdrasil fills that gap.

Git remembers what changed.

Yggdrasil helps the repository remember what the system is.

***

## 🚫 What it is not

Yggdrasil is not a code generator.

Your agent still writes the code. Yggdrasil helps it write better code by giving it better context.

Yggdrasil is not manual documentation.

You are not expected to maintain a wiki by hand. The memory is built and updated as real work happens.

Yggdrasil is not tied to one provider.

It works with the tools you already use.

Yggdrasil is not invasive.

Remove `.yggdrasil` and your codebase still works exactly as before.

***

## 🖥️ Supported platforms

- Cursor
- Claude Code
- GitHub Copilot
- Codex
- Cline / RooCode
- Windsurf
- Aider
- Gemini CLI
- Amp

More can be added.

***

## 📊 Early results

Experiments on real open-source repositories (Hoppscotch, Medusa, Django, DRF, Caddy, Payload CMS) across Python, Go, and TypeScript.

**Meaning capture** (Series 2-3): an agent using only Yggdrasil context answered 15/15 architectural questions correctly across 3 repos. Isolated agents with no code access scored 89.5%. A graph with just 4 nodes delivered 92% of the quality of a full graph.

**Invisibility** (Series 5, 5 experiments across 3 repos):

- Graph auto-constructed from git history: 100% structural coverage on repos with rich commit culture. Zero fabrication across all repos.
- PR-based graph maintenance: 100% precision, 0% false positives. The graph can maintain itself.
- Keyword search selects the right nodes for a task at 89% precision, 96% recall. No ML or embeddings needed.
- Context injected into agent prompt without user action: 97.5% as effective as manual protocol. +178% over no-graph on constraint-aware tasks.
- A guided 8-13 question session produces a graph at 82-90% of expert quality. No Yggdrasil knowledge required.

The persistent gap is decision capture (32-86%). The hardest knowledge to extract is *why* something was designed a certain way and what alternatives were rejected. This is also the highest-value content.

These results validate the core thesis: AI agents do not need bigger context windows. They need memory.

***

## ✅ When it is worth it

Yggdrasil is worth it when:

- your agent keeps making the same mistakes,
- your project is too large for one-shot context dumps,
- architectural knowledge keeps evaporating between sessions,
- multiple people or agents touch the same system,
- you are tired of re-explaining the same decisions over and over.

***

## ⏳ When it is not worth it yet

Yggdrasil is probably not worth it yet when:

- your project is small enough that the agent can see everything at once,
- you are writing simple scripts with little cross-module complexity,
- you are still in throwaway prototype mode and architecture does not matter yet.

***

## 📚 Documentation

Full specification and architecture:

[https://krzysztofdudek.github.io/Yggdrasil/](https://krzysztofdudek.github.io/Yggdrasil/)

***

## 📄 License

MIT — see [LICENSE](LICENSE).
