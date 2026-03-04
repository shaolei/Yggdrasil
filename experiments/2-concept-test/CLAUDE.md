@.yggdrasil/agent-rules.md
@AGENTS.md

## ACTIVE TASK — Meaning Capture Experiment

**Goal:** Test whether Yggdrasil's process (concept + CLI + agent rules) actually captures MEANING — not just structure. The thesis: "Output quality is a function of graph quality." The completeness test: "Can an agent recreate correct code from ONLY the context package?"

**Working memory:** `/workspaces/memory2/`
**Status file:** `/workspaces/memory2/task-state.md` (updated continuously)
**Report:** `/workspaces/Yggdrasil/.plans/meaning-capture-experiment-report.md`

**Constraints:**

- NO commits to cloned repos (read-only analysis + graph building)
- DO NOT modify Yggdrasil source code (this tests the concept, not the tool)
- NEVER ask user for feedback — work fully autonomously
- Save observations to memory2/ continuously, not at the end
- Per-repo findings in `/workspaces/memory2/<repo>-findings.md`

**Experiment structure (3 axes):**

### Axis 1: Brownfield — "Does the graph capture what code can't say?" (3 repos)

1. **cal.com/cal.com** — scheduling, business logic, domain decisions
2. **medusajs/medusa** — e-commerce, order states, pricing rules
3. **hoppscotch/hoppscotch** — API client, real-time, workspace isolation

Per repo: pick ONE meaningful module, run full Yggdrasil process, then:

- **Blindfold test**: answer 5 questions using ONLY `yg build-context` output
- **Recreate test**: write implementation from ONLY context package, compare
- **Self-calibration test**: shallow graph → materialize → enrich → re-materialize

### Axis 2: Greenfield — "Can the graph be a specification?" (1 project)

Webhook relay service. Graph first (aspects, flows, nodes), then materialize code from context packages only.

### Axis 3: Critical analysis (cross-cutting)

Per test: value vs. cost, capture limits, aspects vs. comments, flow vs. docs, token economics.
