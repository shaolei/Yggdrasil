<div align="center">
  <img src="docs/public/logo.svg" alt="Yggdrasil" width="150" />
</div>

<video src="https://github.com/user-attachments/assets/49c8fe8f-c3b9-4202-b655-7f987dcab4cb" controls></video>

# Yggdrasil

## Stop re-explaining your codebase to your AI agent

AI agents keep forgetting your architecture, constraints, and past decisions. Yggdrasil gives your repository persistent semantic memory, so each task starts with the right context instead of another giant prompt.

[![CI](https://github.com/krzysztofdudek/Yggdrasil/actions/workflows/ci.yml/badge.svg)](https://github.com/krzysztofdudek/Yggdrasil/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@chrisdudek/yg.svg)](https://www.npmjs.com/package/@chrisdudek/yg)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![codecov](https://codecov.io/gh/krzysztofdudek/Yggdrasil/graph/badge.svg)](https://codecov.io/gh/krzysztofdudek/Yggdrasil)

---

## 🔍 The problem

Your agent reads `OrderService.ts`. Maybe `PaymentService.ts`. It sees the code. It does not see:

- that rate limiting rules apply here,
- that this area uses event sourcing,
- that a PCI compliance aspect requires audit logging on every data change,
- that the current retry logic exists because of a production incident six months ago.

So it guesses. It makes a change that looks plausible. It breaks things you didn't know it could reach.

Code has logic. It does not have meaning. The most valuable knowledge in your codebase isn't in any file — it lives in the connections between files, in cross-cutting rules, in decisions that were made and alternatives that were rejected. Agents can't see that. Neither can grep. Neither can RAG.

---

## ✅ With Yggdrasil

Same task: "add payment retry to OrderService."

The agent runs `yg build-context --node orders/order-service` and gets:

```
DOMAIN       Orders — lifecycle states, event-sourced transitions
SELF         OrderService — create, validate, manage state
INTERFACE    createOrder(), retryPayment(), cancelOrder()
ASPECT       rate-limiting · max 3 retries/min per order
ASPECT       event-sourcing · all state changes via event log
ASPECT       idempotency · key = orderId + attempt
DEPENDS      PaymentService.charge() .refund()
ON FAIL      retry 3x → mark payment-failed
FLOW         Checkout: Orders → Payments → Inventory → Notify
DECISION     Sync retry chosen over queue — latency <500ms required
```

Everything it needs. Nothing it doesn't. Not a pile of files — a map of the system, with cross-cutting rules, dependencies, and the decisions behind them.

The agent implements the retry. It respects rate limiting, follows event sourcing, generates idempotency keys, handles saga rollback. All tests pass. Zero rework.

---

## 📊 Results

Tested on real open-source repositories: Hoppscotch, Medusa, Django, DRF, Caddy, Payload CMS. Python, Go, TypeScript. [Full methodology and raw data](https://krzysztofdudek.github.io/Yggdrasil/).

| What was tested                                                          | Result                        |
| ------------------------------------------------------------------------ | ----------------------------- |
| Architectural questions answered correctly (graph context only, no code) | **15/15**                     |
| Agent accuracy with zero code access, graph only                         | **89.5%**                     |
| Effectiveness vs manual expert protocol                                  | **97.5%**                     |
| Improvement over no-graph on constraint-aware tasks                      | **+178%**                     |
| Graph auto-constructed from git history — structural coverage            | **100%**                      |
| PR-based graph maintenance — precision                                   | **100%**, 0% false positives  |
| Keyword search node selection                                            | **89% precision**, 96% recall |
| Guided onboarding session (8-13 questions) — graph quality vs expert     | **82-90%**                    |

The persistent gap: decision capture (32-86%). The hardest knowledge to extract is _why_ something was designed a certain way. This is also the highest-value content.

---

## 🚀 Quick start

```bash
npm install -g @chrisdudek/yg
```

```bash
cd your-project
yg init --platform cursor  # or: claude-code, copilot, codex, cline, windsurf, aider, gemini-cli, amp
```

`yg init` creates a `.yggdrasil/` folder in your repo and adds a rules file for your platform (e.g., `.cursor/rules/yggdrasil.mdc` for Cursor, `AGENTS.md` section for Copilot). The rules file teaches your agent to read the graph before modifying code and update it after changes. Your existing rules are not touched.

Two ways to start building knowledge:

**Reverse-engineer from code** — point the agent at existing code and let it analyze: "Reverse-engineer the payments module — figure out responsibilities, dependencies, and constraints from the code." The agent reads the source, creates nodes, and drafts the graph. You review and correct.

**Describe it yourself** — tell the agent what you know: "The orders module manages lifecycle states, depends on payments and inventory, and must always emit audit events." The agent captures it directly.

Both work. Mix them as you go. Either way:

1. **Map a module.** The agent creates nodes, writes responsibilities, declares relations.
2. **Mention a rule.** "All payment changes must emit audit events." The agent captures it as an aspect.
3. **Describe a process.** "Walk me through the checkout flow end to end." The agent creates a flow.
4. **Keep working.** Every conversation enriches the graph. After a few sessions, the agent stops asking the same questions — the answers are already there.

The first useful graph takes about 10-15 minutes. After that, knowledge accumulates passively as you work.

---

## ⚙️ How it works

1. You run `yg init` in your project.
2. A `.yggdrasil` folder appears in the repo.
3. As your agent works, it builds and updates semantic memory about the system.
4. Before changing a file, the agent loads relevant context from the graph.
5. Yggdrasil returns a short, bounded context package for that exact area.
6. The agent writes code and updates memory in the same step.

The memory is stored as plain Markdown and YAML.

No database. No lock-in. No hidden black box.

Delete `.yggdrasil` and your project works exactly as before.

---

## 🧩 Building blocks

**Nodes** are the core units. They form a tree — parent nodes provide domain context, children inherit it. A node can map to a single file, a directory, or a group of files.

**Relations** connect nodes. They describe which parts of the system depend on each other, what is consumed, and what happens when a dependency fails.

**Flows** describe business processes that span multiple nodes. "Customer checks out an order" is a flow — it touches orders, payments, inventory, notifications. Without flows, this end-to-end knowledge lives in no single file and gets lost between sessions.

**Aspects** capture cross-cutting requirements: audit logging, rate limiting, authentication, idempotency — rules that apply across many parts of the system. Define it once, apply it where it belongs.

Together, these give the agent a structured map of your system — not just files, but meaning.

---

## 🖥️ Supported platforms

Cursor · Claude Code · GitHub Copilot · Codex · Cline / RooCode · Windsurf · Aider · Gemini CLI · Amp

`yg init --platform <name>` generates the appropriate rules file for your tool. Adding a new platform is a single config file — PRs welcome.

---

## When it is worth it

- Your agent keeps making the same mistakes.
- Your project is too large for one-shot context dumps.
- Architectural knowledge keeps evaporating between sessions.
- Multiple people or agents touch the same system.
- You are tired of re-explaining the same decisions.

## When it is not worth it yet

- Your project is small enough that the agent can see everything at once.
- You are writing simple scripts with little cross-module complexity.
- You are still in throwaway prototype mode.

---

## 🌱 How knowledge grows

Yggdrasil is not a scanner that indexes your code automatically. The knowledge it holds is built through your conversations with the agent.

This is deliberate. Automatically extracted information is shallow — function signatures, file lists, import graphs. The knowledge that actually prevents broken changes is deeper: _why_ this module exists, _what_ must never break, _which_ business rules apply here, _what_ was tried before and rejected. That kind of knowledge comes from you.

Here is what a first session looks like:

```
You:    "Map the payments module."
Agent:  Creates node payments/payment-service, writes responsibility.md,
        declares relations to orders and inventory.

You:    "All payment operations must emit audit events."
Agent:  Creates aspect requires-audit, applies it to payment-service.

You:    "We chose sync retries over a queue because latency must stay under 500ms."
Agent:  Records the decision in internals.md — including the rejected alternative.
```

After 10-15 minutes, the agent has a working graph for one area of your system. From that point, every conversation deepens it. The effort curve is steep at the start and near-zero once mature — the agent maintains the graph as part of normal work.

---

## ❓ FAQ

**How is this different from a rules file (CLAUDE.md, .cursorrules)?**
Rules files are flat text — global conventions pasted into every prompt. They don't know which rules apply to which part of the system. Yggdrasil is a structured graph with inheritance, scoped aspects, typed relations, and flows. Your agent gets context _for the specific node it's working on_, not a wall of text it has to filter through.

**How is this different from RAG?**
RAG retrieves text chunks that are textually similar to your query. It finds _more files_. It doesn't find the cross-cutting knowledge that lives _between_ files — which aspects apply here, what business flow passes through this code, what breaks downstream if you change this interface. Yggdrasil captures architectural meaning, not textual similarity.

## 🙅‍♂️ What it is not

Yggdrasil is not a code generator. Your agent still writes the code — Yggdrasil gives it better context.

Yggdrasil is not manual documentation. Memory is built and updated as real work happens.

Yggdrasil is not tied to one provider. It works with the tools you already use.

Yggdrasil is not invasive. Remove `.yggdrasil` and your codebase works exactly as before.

---

## Documentation

Full specification and architecture:

[https://krzysztofdudek.github.io/Yggdrasil/](https://krzysztofdudek.github.io/Yggdrasil/)

---

## License

MIT — see [LICENSE](LICENSE).
