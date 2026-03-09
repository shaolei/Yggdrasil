# Experiment 5.5: Graph Quality Without Domain Expertise

## Hypothesis

**H1**: A non-expert (developer who knows the code but NOT Yggdrasil) guided by
automated extraction prompts can produce a graph that achieves ≥80% of the blindfold
score of an expert-built graph.

**H0**: Graph quality fundamentally depends on Yggdrasil expertise. Without understanding
aspects, flows, and graph architecture, the resulting graph is too shallow or
structurally wrong to be useful (quality <60% of expert graph).

## Product Question

**Can Yggdrasil onboard developers without training?** If yes, what automated
guidance is sufficient? If no, what is the minimum training investment?

## Why This Matters

Exp 2 (meaning capture) found that "graph quality depends on the modeler." This
creates a chicken-and-egg problem: Yggdrasil is most valuable for teams that don't
have time to learn new tools. If onboarding requires expertise, adoption stalls.

This experiment tests whether the TOOL can compensate for the USER's lack of knowledge.

## Variables

| Type | Variable | Values |
|---|---|---|
| Independent | Builder expertise | E1: expert (knows Yggdrasil deeply) / E2: guided novice (developer + automated prompts) / E3: unguided novice (developer + docs only) |
| Dependent | Blindfold score | Evaluator score on 15 diagnostic questions |
| Dependent | Structural quality | Node/relation/aspect/flow coverage vs code architecture |
| Dependent | Semantic depth | Decision capture, "why NOT", constraint coverage |
| Dependent | Error rate | Fabricated or wrong information in graph |
| Dependent | Time to build | Wall-clock hours to construct the graph |
| Controlled | Target area | Same modules |
| Controlled | Evaluator | Same agent, same questions |
| Controlled | Developer knowledge | Same developer (knows the code, not Yggdrasil) |

## Prerequisites

- 2 repos (reduced due to human involvement requirement)
- A simulated "non-expert developer" role (see Role Simulation below)
- Reference graph built by expert for each repo

## Role Simulation

Since we cannot recruit actual developers for this experiment, we simulate the
"non-expert developer" as follows:

**Simulated developer** is an agent that:
- Has full access to source code (knows WHAT the code does)
- Has NO knowledge of Yggdrasil concepts (aspects, flows, nodes, relations)
- Responds to extraction questions with information from the code
- Does NOT volunteer architectural insights unprompted
- Uses developer vocabulary, not Yggdrasil vocabulary

**Extraction agent** is a separate agent that:
- Knows Yggdrasil deeply (has read all docs and schemas)
- Cannot read source code directly
- Can only learn about the code by asking the simulated developer questions
- Builds the graph from the developer's answers

This creates a clean separation: code knowledge lives with the "developer,"
graph knowledge lives with the extraction agent.

**Limitation**: A simulated developer may answer more consistently than a real one.
Results should be interpreted as an upper bound on non-expert quality. Future
validation with real developers is recommended if results are promising.

## Repos

Use 2 repos from the candidate list. Ensure:
- At least 2 languages
- Target areas with enough decision density for meaningful comparison

## Guided Extraction Protocol

The extraction agent uses a structured question protocol organized in phases.
This protocol is the PRODUCT ARTIFACT being tested — if the experiment succeeds,
this protocol becomes the basis for an `yg guided-init` command.

### Phase A: Module Discovery

Questions about the codebase structure:

```
A1. "What are the main components/modules in [target area]? For each one,
     describe in 1-2 sentences what it does."

A2. "For each component you listed, what files contain its implementation?"

A3. "Which of these components interact with each other? For each interaction,
     who calls whom and why?"

A4. "Are there any components that affect multiple other components without
     being explicitly called? (Examples: middleware, guards, interceptors,
     decorators, plugins, event handlers)"
```

→ From answers: create initial node structure + relations + infrastructure nodes

### Phase B: Cross-Cutting Pattern Extraction

Questions about patterns:

```
B1. "I see [components A, B, C] all interact with [shared concern X].
     Is there a common pattern or rule they all follow when doing this?
     (e.g., all use the same locking strategy, all handle errors the same way)"

B2. "Are there any rules that apply to MULTIPLE components? For example:
     - Error handling patterns (retry, fallback, propagate)
     - Concurrency rules (locking, transaction isolation)
     - Data validation rules
     - Security/authorization patterns
     - Event publishing patterns"

B3. "For each pattern you described: are there any components that follow it
     DIFFERENTLY or have exceptions? For example, 'all use fire-and-forget
     events EXCEPT component X which awaits them.'"
```

→ From answers: create aspects + aspect_exceptions

### Phase C: Business Process Extraction

Questions about what happens end-to-end:

```
C1. "Describe a typical user journey through [target area]. What happens from
     the user's perspective, step by step?"

C2. "What can go wrong during this process? For each failure point, what happens
     to the user and to the data?"

C3. "Are there any ordering requirements? Things that MUST happen before other
     things, or things that MUST NOT happen at the same time?"
```

→ From answers: create flows

### Phase D: Decision Extraction (Highest-Value Phase)

Questions about WHY:

```
D1. "For [specific design choice X visible in code]: why was it done this way?
     Was anything else considered?"

D2. "I notice [component Y] uses [approach A]. The simpler approach would be
     [approach B]. Is there a reason [approach A] was chosen?"

D3. "Are there any constraints that aren't obvious from reading the code?
     Things a new developer might accidentally break because they don't know
     about them?"

D4. "Have there been any significant debates or discussions about how to
     implement [feature Z]? What were the options and why was the current
     approach chosen?"
```

→ From answers: create decisions in internals.md, "why NOT" entries

### Phase E: Gap-Filling (Iterative)

After initial graph construction, the extraction agent:
1. Runs `yg build-context` for each node
2. Identifies gaps (missing constraints, unexplained patterns)
3. Asks targeted follow-up questions
4. Maximum 2 rounds of gap-filling

## Protocol

### Phase 1: Expert Reference (per repo)

Follow METHODOLOGY.md §Reference Graph Protocol:
1. Expert builds full graph for target area
2. Create 15 questions + gold standard answers
3. Validate: blindfold score ≥90/125

**Output**: `reference/` directory

### Phase 2: Guided Novice Construction (per repo) — condition E2

1. Set up simulated developer agent (source code access, no Yggdrasil knowledge)
2. Set up extraction agent (Yggdrasil knowledge, no source code access)
3. Extraction agent runs the guided protocol (Phases A→E above)
4. After each phase, extraction agent creates/updates graph artifacts
5. After Phase E, run `yg validate` and fix errors
6. Record:
   - Total questions asked
   - Total developer "I don't know" responses
   - Time per phase
   - Questions that produced the most valuable graph content

**Output**: `guided/` directory with graph + interaction transcript

### Phase 3: Unguided Novice Construction (per repo) — condition E3

1. Set up simulated developer agent (source code access, Yggdrasil docs access,
   NO guided protocol)
2. Developer agent reads Yggdrasil documentation (docs/ directory)
3. Developer agent attempts to build the graph independently
4. Record time and questions/confusions encountered

This tests the baseline: can someone build a graph just by reading the docs?

**Output**: `unguided/` directory with graph + notes on difficulties

### Phase 4: Structural Comparison

Compare all three graphs on structural elements:

| Element | E1 (expert) | E2 (guided) | E3 (unguided) |
|---|---|---|---|
| Node count | | | |
| Relation count | | | |
| Aspect count | | | |
| Flow count | | | |
| File mapping coverage | | | |
| Infrastructure nodes identified | | | |

**Output**: `comparison/structural.md`

### Phase 5: Semantic Comparison

For matching elements across graphs, compare content depth:

**Per-artifact comparison** (3-point scale: equivalent / partial / minimal):
- responsibility.md content
- interface.md content
- internals.md content
- Aspect content
- Flow content
- Decision coverage (count of decisions captured)
- "Why NOT" coverage (count of rejected alternatives captured)
- Constraint coverage (count of non-obvious constraints captured)

**Output**: `comparison/semantic.md`

### Phase 6: Blindfold Evaluation

Run standard evaluation protocol:

| Condition | What evaluator receives |
|---|---|
| B0 | Raw source code only |
| B1 | `yg build-context` from expert graph (E1) |
| T2 | `yg build-context` from guided novice graph (E2) |
| T3 | `yg build-context` from unguided novice graph (E3) |

3 runs per condition. Same 15 questions. Same scorer.

**Output**: `evaluation/` directory

### Phase 7: Question-Level Analysis

For each of the 15 questions, track:
- Which conditions got it right/wrong
- WHY wrong answers occurred:
  - Missing node in graph
  - Missing artifact content
  - Missing aspect
  - Missing decision/rationale
  - Wrong information in graph

Map failures back to extraction protocol phases:
- If Phase D (decisions) is the main gap → the protocol needs better decision questions
- If Phase B (patterns) is the main gap → the protocol needs better pattern questions
- If structural issues → Phase A needs improvement

**Output**: `evaluation/question-analysis.md`

### Phase 8: Extraction Protocol Quality Analysis

Evaluate the guided extraction protocol itself:

| Metric | How measured |
|---|---|
| Question efficiency | (graph elements created) / (questions asked) |
| Redundancy | % of questions that produced no new graph content |
| Gap rate | % of reference elements NOT discovered by any question |
| ROI by phase | Which phase produced the most graph value per question? |
| "I don't know" rate | % of questions developer couldn't answer |
| Follow-up necessity | % of elements that required Phase E follow-ups |

Rank extraction questions by value (most graph content per question).
Identify the "minimum viable question set" — the smallest set of questions
that captures ≥80% of the graph content.

**Output**: `evaluation/protocol-analysis.md`

## Success Criteria

| Metric | INVEST threshold | ITERATE threshold | ABANDON threshold |
|---|---|---|---|
| E2 blindfold vs E1 blindfold | E2 ≥ 80% of E1 | 65-79% | <65% |
| E2 blindfold vs B0 | E2 > B0 + 10% | E2 > B0 + 5% | E2 ≤ B0 |
| E3 blindfold vs E1 blindfold | E3 ≥ 60% of E1 | 40-59% | <40% |
| E2 decision capture vs E1 | E2 ≥ 60% of E1 decisions | 40-59% | <40% |
| E2 "why NOT" capture vs E1 | E2 ≥ 40% of E1 "why NOT" | 20-39% | <20% |
| E2 time vs E1 time | E2 ≤ 150% of E1 | 150-250% | >250% |
| Minimum viable question set size | ≤15 questions | 15-25 | >25 |

## Decision Framework

**If INVEST:**
- Build `yg guided-init` command that:
  1. Scans source code to identify modules
  2. Asks the developer the guided extraction questions
  3. Builds graph from answers
  4. Runs self-calibration loop (exp 4.3 validated this converges in 2 cycles)
- Ship the minimum viable question set as the default protocol
- Priority: HIGH (removes expertise barrier)

**If ITERATE:**
- Identify which phases of the protocol are weakest
- Test: does combining auto-construct (5.1) with guided extraction improve results?
  (Auto-construct builds structure, guided extraction fills in WHY)
- Test: does showing the developer the auto-constructed graph and asking
  "is this right?" produce better results than asking from scratch?

**If ABANDON:**
- Yggdrasil requires training — document the minimum training
- Create a "Yggdrasil onboarding course" (video/docs) as the primary onboarding path
- Consider: is the problem the extraction protocol or the simulation of non-experts?

## Known Risks

1. **Simulated developer is not a real developer.** An LLM playing "developer" may
   answer differently than a real person. Real developers may:
   - Not remember why decisions were made
   - Give incomplete answers
   - Push back on the process ("why do I need to answer these questions?")
   - Have domain knowledge the simulation lacks
   Document this as a limitation. If results are promising, follow up with real
   developer validation.

2. **Developer patience.** The guided protocol asks many questions. Real developers
   may abandon the process if it takes too long. Track the minimum viable question
   set to estimate the "patience threshold."

3. **Code familiarity varies.** Some developers wrote the code; others inherited it.
   The simulation assumes full code familiarity. Real results may be lower for
   inherited codebases.

4. **Extraction agent quality.** The extraction agent's ability to translate
   developer answers into graph artifacts is itself a variable. Use the same agent
   model across all repos for consistency.

## Estimated Duration

- Phase 1 (expert reference): 3-5 hours per repo
- Phase 2 (guided construction): 3-4 hours per repo
- Phase 3 (unguided construction): 2-3 hours per repo
- Phase 4-5 (comparison): 1-2 hours per repo
- Phase 6 (blindfold): 3-4 hours per repo (12 runs × 15 questions)
- Phase 7-8 (analysis): 2-3 hours per repo
- Total: ~20-25 hours per repo, ~40-50 hours total
