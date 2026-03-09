<div align="center">
  <img src="docs/public/logo.svg" alt="Yggdrasil" width="150" />
</div>

# Yggdrasil

### Stop re-explaining your codebase to your AI agent.

AI agents keep forgetting your architecture, constraints, and past decisions. Yggdrasil gives your repository persistent semantic memory, so each task starts with the right context instead of another giant prompt.

[![CI](https://github.com/krzysztofdudek/Yggdrasil/actions/workflows/ci.yml/badge.svg)](https://github.com/krzysztofdudek/Yggdrasil/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@chrisdudek/yg.svg)](https://www.npmjs.com/package/@chrisdudek/yg)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![codecov](https://codecov.io/gh/krzysztofdudek/Yggdrasil/graph/badge.svg)](https://codecov.io/gh/krzysztofdudek/Yggdrasil)

***

## Why this exists

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

## What you get

Yggdrasil gives your repository persistent semantic memory.

Instead of dumping the whole repo into a prompt, it gives the agent the exact context needed for the part of the system it is changing.

That means:

- Less re-explaining the same architecture over and over.
- Fewer broken edits caused by missing context.
- Less prompt bloat and fewer giant rules files.
- Better AI-assisted changes on medium and large codebases.
- Architectural knowledge that survives between sessions, people, and tools.

***

## One example

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

## Install

```bash
npm install -g @chrisdudek/yg
```

***

## Initialize

```bash
cd your-project
yg init --platform <platform>
```

That is it.

Your agent now has persistent semantic memory.

***

## How it works

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

## What Yggdrasil actually stores

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

## Why this matters

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

## What it is not

Yggdrasil is not a code generator.

Your agent still writes the code. Yggdrasil helps it write better code by giving it better context.

Yggdrasil is not manual documentation.

You are not expected to maintain a wiki by hand. The memory is built and updated as real work happens.

Yggdrasil is not tied to one provider.

It works with the tools you already use.

Yggdrasil is not invasive.

Remove `.yggdrasil` and your codebase still works exactly as before.

***

## Supported platforms

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

## Early results

I ran experiments on real open-source repositories, including projects like Hoppscotch, Medusa, and Django.

Early takeaways:

- In some cases, an agent using only Yggdrasil context could build a correct service without reading the source repo directly.
- You do not need perfect setup from day one. Starting messy is fine.
- You do not need to map the whole codebase upfront. A few important areas already create value.
- The biggest limitation is still coverage. Memory only helps where the system has actually been mapped.

This is still early.

But the core idea is already clear.

AI agents do not need bigger context windows.

They need memory.

***

## When it is worth it

Yggdrasil is worth it when:

- your agent keeps making the same mistakes,
- your project is too large for one-shot context dumps,
- architectural knowledge keeps evaporating between sessions,
- multiple people or agents touch the same system,
- you are tired of re-explaining the same decisions over and over.

***

## When it is not worth it yet

Yggdrasil is probably not worth it yet when:

- your project is small enough that the agent can see everything at once,
- you are writing simple scripts with little cross-module complexity,
- you are still in throwaway prototype mode and architecture does not matter yet.

***

## Documentation

Full specification and architecture:

[https://krzysztofdudek.github.io/Yggdrasil/](https://krzysztofdudek.github.io/Yggdrasil/)

***

## License

MIT — see [LICENSE](LICENSE).
