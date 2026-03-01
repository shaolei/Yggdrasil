# Flow Variants (Agent Awareness) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend flow `description.md` specification so agents document all process paths (happy path, exceptions, cancellations), not just success. Documentation-only — graph.md, rules.ts, tools.md.

**Architecture:** Three coordinated edits. graph.md explains concepts and required format. rules.ts instructs the agent. tools.md provides formal spec. No CLI changes.

**Tech Stack:** Markdown, TypeScript (rules.ts)

---

## Task 1: graph.md — Flow description format

**Files:**
- Modify: `docs/idea/graph.md` (Flows section, ~lines 480–516)

**Step 1: Add rationale paragraph**

After "Content artifacts in the flow directory (`description.md`, `sequence.md`, etc.) describe flow behavior, sequence, error handling, and edge cases." add:

```markdown
One flow directory represents one business process with all its paths — happy path, exceptions, cancellations. The `description.md` describes the full scope of that process, not just the success path.
```

**Step 2: Add "Flow description.md format" subsection**

Before the closing `---` of the Flows section, add:

```markdown
### Flow description.md format

Every flow's `description.md` must include these sections:

- `## Business context` — why this process exists
- `## Trigger` — what initiates the process
- `## Goal` — what success looks like
- `## Participants` — nodes involved (align with `flow.yaml` nodes)
- `## Paths` — **required**; must contain at least `### Happy path`; each other business path (cancellation, payment failure, timeout, partial fulfillment) gets its own `### [name]` subsection
- `## Invariants across all paths` — business rules and technical conditions that hold regardless of path

Example variant names: `### Payment failed`, `### User cancellation`, `### Timeout`, `### Partial fulfillment`
```

**Step 3: Verify**

Run: `npx markdownlint-cli2 "docs/idea/graph.md" ".markdownlint-cli2.jsonc"`
Expected: 0 errors

**Step 4: Commit**

```bash
git add docs/idea/graph.md
git commit -m "docs: flow description.md required format — all paths, not just happy path"
```

---

## Task 2: rules.ts — Agent instructions for flow description

**Files:**
- Modify: `source/cli/src/templates/rules.ts` (Section 7, ~line 198)

**Step 1: Extend "Flows — writing flow content" bullet**

Find: `* **Flows — writing flow content:** When creating or editing flow artifacts (e.g. \`description.md\` in \`flows/&lt;name&gt;/\`), write business-first: describe the process from user/business perspective. Technical details only as inserts when they clarify the flow. Not technical-first with business inserts.`

Replace with:

```
* **Flows — writing flow content:** When creating or editing flow artifacts (e.g. \`description.md\` in \`flows/&lt;name&gt;/\`), write business-first: describe the process from user/business perspective. Technical details only as inserts when they clarify the flow. Not technical-first with business inserts. \`description.md\` must describe the full scope of the process — all paths (happy path, exceptions, cancellations), not just the success path.
```

**Step 2: Add "Flow description.md — required structure" block**

After the Flows bullet, add a new bullet:

```
* **Flow description.md — required structure:** Every flow \`description.md\` must have: \`## Business context\`, \`## Trigger\`, \`## Goal\`, \`## Participants\`, \`## Paths\`, \`## Invariants across all paths\`. \`## Paths\` is required and must contain at least \`### Happy path\`. Each other business path (error, cancellation, timeout, partial fulfillment) gets its own \`### [name]\` subsection. One flow = one business process with all its variants.
```

**Step 3: Verify**

Run: `cd source/cli && npm run build`
Expected: success

**Step 4: Commit**

```bash
git add source/cli/src/templates/rules.ts
git commit -m "rules: flow description.md required structure — Paths, Happy path, all variants"
```

---

## Task 3: tools.md — Formal spec for description.md

**Files:**
- Modify: `docs/idea/tools.md` (after flow.yaml subsection, ~line 210)

**Step 1: Add description.md subsection**

After the flow.yaml validation rules and before `### templates/ schemas`, add:

```markdown
### description.md

Primary flow content artifact — describes the business process. Required for every flow.

**Required sections (H2):**

- `## Business context` — why this process exists
- `## Trigger` — what initiates the process
- `## Goal` — what success looks like
- `## Participants` — nodes involved (align with `flow.yaml` nodes)
- `## Paths` — must contain at least `### Happy path`; each additional business path (exception, cancellation, timeout) gets `### [name]`
- `## Invariants across all paths` — business rules and technical conditions holding across all paths

One flow directory = one business process with all its paths (happy path, exceptions, cancellations).
```

**Step 2: Verify**

Run: `npx markdownlint-cli2 "docs/idea/tools.md" ".markdownlint-cli2.jsonc"`
Expected: 0 errors

**Step 3: Commit**

```bash
git add docs/idea/tools.md
git commit -m "docs: tools.md — description.md required structure spec"
```

---

## Task 4: Update existing flows (optional, dogfooding)

**Files:**
- Modify: `.yggdrasil/flows/validate/description.md`
- Modify: `.yggdrasil/flows/build-context/description.md`
- Modify: `.yggdrasil/flows/drift/description.md`
- Modify: `.yggdrasil/flows/init/description.md`

**Step 1: Restructure each description.md**

Add missing sections (Business context, Trigger, Goal, Participants, Paths with Happy path + variants, Invariants). Existing content (Sequence, Participants, Output) maps into the new structure.

**Step 2: Verify**

Run: `yg validate`
Expected: no issues

**Step 3: Commit**

```bash
git add .yggdrasil/flows/*/description.md
git commit -m "yggdrasil: align flow descriptions to new format"
```

---

## Summary

| Task | Files | Commit |
|------|-------|--------|
| 1 | graph.md | flow description format |
| 2 | rules.ts | agent instructions |
| 3 | tools.md | formal spec |
| 4 | .yggdrasil/flows/* | dogfood (optional) |
