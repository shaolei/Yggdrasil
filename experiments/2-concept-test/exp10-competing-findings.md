# Experiment 10: Competing Knowledge Representations -- Findings

## Scoring Matrix

| Question | Rep A (Yggdrasil) | Rep B (ADRs) | Rep C (Comments) | Rep D (README) |
|----------|-------------------|--------------|------------------|----------------|
| Q1       | 2                 | 2            | 2                | 2              |
| Q2       | 2                 | 2            | 2                | 2              |
| Q3       | 2                 | 2            | 2                | 2              |
| Q4       | 2                 | 2            | 2                | 2              |
| Q5       | 2                 | 2            | 2                | 2              |
| Q6       | 1                 | 1            | 2                | 2              |
| Q7       | 2                 | 2            | 2                | 2              |
| Q8       | 2                 | 2            | 2                | 2              |
| **Total**| **15/16**         | **15/16**    | **16/16**        | **16/16**      |

## Per-Question Analysis

### Q1: Delete with Reindexing

**Knowledge type:** Behavioral (algorithm mechanics), invariant enforcement.

All four representations scored CORRECT (2). Every representation accurately described:

- D's orderIndex changes from 4 to 3, E's from 5 to 4
- The mechanism: decrement all siblings with orderIndex > deleted item's orderIndex
- The contiguity invariant (1..N with no gaps)
- The retry loop and pessimistic locking context

**Differentiators:** Rep C provided line-number references showing exactly where the code executes each step. Rep A cited specific artifact files (constraints.md, retry-on-deadlock aspect). Rep B and Rep D cited their respective documentation structures. All were equivalent in factual accuracy.

**Best suited representation:** All were equally adequate. This is a straightforward behavioral question where any well-documented system will perform well.

---

### Q2: Cycle Detection

**Knowledge type:** Algorithm mechanics, design rationale (walk-up vs walk-down).

All four representations scored CORRECT (2). Every representation accurately described:

- The move is NOT allowed
- The isParent walk-up algorithm with correct trace (D -> C -> B found)
- The error code TEAM_COLL_IS_PARENT_COLL
- The rationale: O(depth) walk-up vs O(subtree_size) walk-down

**Differentiators:** Rep C provided specific return values (O.none = invalid, O.some(true) = valid). Rep D mentioned the known N+1 query limitation and a CTE alternative. Rep A cited the specific decision document. These are minor differentiators -- all captured the essential behavior and rationale.

**Best suited representation:** All were equally adequate. The algorithm is well-defined and all representations captured both the "what" and the "why."

---

### Q3: Concurrent Deletes

**Knowledge type:** Concurrency behavior, error handling, edge cases.

All four representations scored CORRECT (2). Every representation accurately described:

- Both operations contend for the same pessimistic lock via lockTeamCollectionByTeamAndParent
- Deadlock possibility when lock acquisition order differs
- Retry loop: 5 retries, linear backoff (retryCount * 100ms), three error codes (UNIQUE_CONSTRAINT_VIOLATION, TRANSACTION_DEADLOCK, TRANSACTION_TIMEOUT)
- Maximum total wait of 1.5 seconds (explicit in Rep C and D, computable from Rep A and B)
- PubSub events after each transaction commits

**Differentiators:** Rep C uniquely mentioned a guard against concurrent deletion (if deletedCollection is falsy, skip reindexing). Rep D mentioned the known limitation about no bulk delete optimization. Rep B clearly separated the two scenarios (serialized vs deadlock). Rep A provided a clean narrative with aspect references.

**Best suited representation:** All were equally adequate for this concurrency question. The slight differences (concurrent deletion guard, bulk delete limitation) are bonus details beyond the expected answer.

---

### Q4: Integer vs Fractional orderIndex

**Knowledge type:** Design rationale, architectural trade-offs.

All four representations scored CORRECT (2). Every representation accurately argued for integer orderIndex with the expected points:

- Contiguous, predictable indexes (1..N)
- No precision exhaustion or rebalancing needed
- Critical for cursor-based pagination
- Consistency over write throughput for a collaborative tool
- Locking already serializes access, making write amplification acceptable

**Differentiators:** Rep A added "consistency over write throughput" as a fifth explicit point about single canonical representation. Rep C uniquely mentioned deterministic duplicate placement (lastIndex + 1). Rep B cited "bounded write amplification" as a distinct point. Rep D emphasized simplicity of the range-shift algorithm.

**Best suited representation:** This is a pure rationale question. All representations handled it equally well because the design decision and its rationale were explicitly documented in every format. This suggests that when a design decision is important enough to document explicitly, the format matters less than the fact of documentation.

---

### Q5: Duplication Process

**Knowledge type:** Multi-step process, code reuse rationale.

All four representations scored CORRECT (2). Every representation accurately described:

- The export-then-import pipeline (not a dedicated deep-copy)
- Step 1: Recursive depth-first export to CollectionFolder JSON
- Step 2: Append " - Duplicate" to root title
- Step 3: Import with new IDs, correct orderIndex, pessimistic locking
- Placement at end of sibling set
- PubSub coll_added events after commit
- Rationale: reuses existing import logic, avoids code duplication

**Differentiators:** Rep C provided the most granular detail with line numbers, showing the exact nested JSON structure and the Promise.all creation pattern. Rep D mentioned a known limitation about recursive sequential queries in export. Rep A and Rep B provided clean summaries with explicit rationale quotes.

**Best suited representation:** All were equally adequate. The process is well-defined and all representations captured the full pipeline.

---

### Q6: Adding Alphabetical Sort Feature

**Knowledge type:** Cross-cutting constraint identification, existing implementation awareness, known limitations.

Rep A and Rep B scored PARTIALLY CORRECT (1). Rep C and Rep D scored CORRECT (2).

The expected answer makes two key points that differentiate the scores:

1. **sortTeamCollections already exists** -- Rep C and Rep D both explicitly confirm this ("This feature essentially already exists!", "The README actually reveals that an alphabetical sort feature already exists"). Rep A hedges ("may already exist or was anticipated") and Rep B similarly hedges ("suggesting this capability exists or was planned"). The expected answer opens with "The `sortTeamCollections` method already exists and handles this" as its primary observation.

2. **PubSub gap is a known limitation** -- Rep C explicitly states "The existing sort method does NOT emit a PubSub event... connected clients won't see the reorder in real-time unless they refresh." Rep D flags it as "known limitation #1." Rep A discusses PubSub prescriptively (what a sort feature should do) without noting the current gap. Rep B mentions PubSub after commit but does not identify the gap.

Additionally, Rep A and Rep B both suggest adding retry-on-deadlock logic to a sort operation. The expected answer does not include this, and Rep C explicitly states "No retry loop needed... the pessimistic lock is sufficient (only delete has the retry loop)." This is a minor inaccuracy of judgment in Rep A and Rep B -- they prescribe a pattern that is not needed for sort.

**Why Rep A and Rep B failed:** The Yggdrasil context package and ADR documents describe patterns and constraints at an abstract level. They correctly identify which patterns apply but struggle to confirm whether the method already exists (a factual implementation detail) and whether the existing implementation has gaps (a known-limitation detail). The commented source code (Rep C) has direct visibility into the actual implementation, and the README (Rep D) explicitly cataloged known limitations.

**Best suited representation:** Rep C (commented code) and Rep D (README) excelled here because the question required knowledge of the actual implementation state, not just the intended design patterns. This is where source-adjacent representations outperform abstract knowledge representations.

---

### Q7: Replacing PubSub with a Message Queue

**Knowledge type:** Impact analysis, architectural change planning.

All four representations scored CORRECT (2). Every representation accurately identified:

- All publish calls need replacement (listed specific methods or event types)
- Channel naming becomes topics/routing keys
- Payload shapes remain the same (or need serialization)
- The "after commit" timing rule still applies
- Reliability improvement opportunity (outbox pattern)
- Core logic (locking, retry, algorithms) is unaffected
- PubSub infrastructure is out of scope for this module

**Differentiators:** Rep C provided the most granular detail with constructor injection specifics, import statement changes, and exact line references for every publish call. Rep B mentioned the outbox pattern was a "rejected alternative in ADR-006." Rep A discussed at-least-once semantics and consumer idempotency. Rep D mentioned schema versioning for forward compatibility.

**Best suited representation:** All were equally adequate. Impact analysis questions benefit from any representation that clearly catalogs the module's external dependencies and interaction points.

---

### Q8: Removing Locking from Reorder

**Knowledge type:** Concurrency failure analysis, invariant violation scenarios, system design justification.

All four representations scored CORRECT (2). Every representation accurately identified:

- Contiguity invariant breaks (duplicate orderIndex, gaps)
- Stale reads cause incorrect range shifts
- Re-read inside transaction is insufficient without lock
- Concurrent operations corrupt overlapping ranges
- Cascading failures (pagination, PubSub events, UI)
- Lock scope is (teamID, parentID), so overhead is minimal -- different subtrees proceed in parallel
- No retry mechanism for reorder to recover from corruption

**Differentiators:** Rep A uniquely addressed why optimistic locking was rejected (reorder touches many rows via updateMany, making version-column retry impractical). Rep B and Rep D provided concrete numerical examples of corruption. Rep C mentioned the "move to end" edge case with getCollectionCount. All representations demonstrated deep understanding of the concurrency implications.

**Best suited representation:** All were equally adequate. This question tests understanding of concurrency invariants, which all representations captured thoroughly.

---

## Key Findings

### 1. Overall Ranking with Scores

| Rank | Representation | Score | Percentage |
|------|---------------|-------|------------|
| 1 (tied) | Rep C (Inline Comments) | 16/16 | 100% |
| 1 (tied) | Rep D (README) | 16/16 | 100% |
| 3 (tied) | Rep A (Yggdrasil) | 15/16 | 93.75% |
| 3 (tied) | Rep B (ADRs) | 15/16 | 93.75% |

The margin between all four representations is remarkably narrow -- a single point separates the top from the bottom. This result is significant in itself.

### 2. What Types of Questions Each Representation Handles Well vs Poorly

**All representations handled equally well (7 of 8 questions):**

- Behavioral/algorithmic questions (Q1, Q2, Q5): How does feature X work?
- Design rationale questions (Q4): Why was decision X made?
- Concurrency/edge case questions (Q3, Q8): What happens under condition X?
- Impact analysis questions (Q7): What changes if we replace X?

**Rep A (Yggdrasil) struggled with:**

- Implementation-state awareness (Q6): Does the feature already exist? What are the known gaps in the current implementation? The abstract constraint-and-pattern model correctly identifies applicable rules but hedges on whether the implementation already exists and misses implementation-level gaps.

**Rep B (ADRs) struggled with:**

- Same as Rep A (Q6): ADRs capture decisions and rationale but are less precise about current implementation state and known limitations.

### 3. Where Yggdrasil's Structured Approach Provides Clear Advantage

In this experiment, Yggdrasil did NOT provide a clear advantage over simpler representations. The reasons are instructive:

- **The module is well-scoped.** TeamCollectionService is a single, cohesive module. All four representations could fully describe it within their format's constraints.
- **The questions tested depth, not breadth.** All questions focused on one module. Yggdrasil's structured approach (aspects, flows, cross-cutting concerns, hierarchical context) is designed to shine when navigating relationships across many modules. This experiment did not test that.
- **Source attribution was useful but not differentiating.** Rep A cited artifact files, Rep B cited ADR numbers, Rep C cited line numbers, Rep D cited section names. All provided good traceability.

Where Yggdrasil showed a **structural advantage** (not reflected in scores because other representations also captured it):

- **Cross-cutting pattern identification:** Rep A naturally surfaced the pessimistic-locking and retry-on-deadlock aspects as reusable patterns applicable across the module. This is exactly how aspects work -- they are first-class entities, not inline annotations.
- **Formal constraint documentation:** The separation of constraints from logic from decisions is cleaner in Rep A than in the other representations, where these are interleaved.

### 4. Where Simpler Representations (ADR, Comments, README) Are Sufficient

**ADRs (Rep B):** Sufficient for all questions in this experiment. ADRs excel at capturing design rationale (Q4, Q8) and are nearly as effective as Yggdrasil for behavioral and concurrency questions. The numbered ADR format provides clean references.

**Inline Comments (Rep C):** The top scorer. Comments embedded in source code provide:

- Exact implementation details with line references
- Immediate awareness of the current implementation state (Q6: "this feature already exists!")
- Known limitations visible alongside the code they affect
- No drift risk -- comments move with the code

**README (Rep D):** Also a top scorer. A well-written README provides:

- Structured overview with clear section organization
- Explicit "Known Limitations" catalog (which proved decisive in Q6)
- Design decision sections that rival ADRs for rationale capture
- A single document that an agent can read in full

### 5. Specific Knowledge Types That Differentiate the Representations

| Knowledge Type | Best Representation(s) | Why |
|---------------|----------------------|-----|
| Algorithm mechanics | All equal | Well-defined behavior is easily documented in any format |
| Design rationale | All equal | All formats explicitly captured "why" decisions |
| Concurrency behavior | All equal | All formats documented locking, retry, deadlock handling |
| Cross-cutting patterns | Rep A (structural advantage, not score advantage) | Aspects are first-class entities in Yggdrasil |
| Implementation state | Rep C, Rep D | Source-adjacent representations know what exists NOW |
| Known limitations | Rep C, Rep D | Inline comments and README sections catalog gaps explicitly |
| Impact analysis | All equal | All formats documented dependencies and interaction points |

## Implications for Yggdrasil

### What This Experiment Tells Us About the Value Proposition

1. **For single-module, depth-focused analysis, Yggdrasil provides no measurable advantage over simpler representations.** All four representations scored within 1 point of each other (15-16/16). A well-written README or well-commented source code file can capture the same behavioral, rationale, and concurrency knowledge.

2. **Yggdrasil's value proposition lies in cross-module, breadth-focused scenarios that this experiment did not test.** The structured graph (aspects, flows, relations, hierarchy) is designed for questions like: "What other modules use pessimistic locking and how would a change to the locking strategy affect them?" or "Trace a request through the import flow across three services." These questions cannot be answered from a single module's README.

3. **The experiment reveals a gap in Yggdrasil's representation.** The Yggdrasil context package (Rep A) was the only representation that hedged on whether sortTeamCollections already exists. This suggests that Yggdrasil's abstraction layer -- while powerful for pattern identification -- can lose touch with concrete implementation details. The graph captures intent and constraints but may not always capture implementation state.

### When Is Yggdrasil Overkill vs Essential?

**Yggdrasil is likely overkill when:**

- The codebase is small enough that a README or ADR set covers all modules
- Questions focus on a single module's internals
- The team maintains high-quality inline comments
- There are few cross-cutting concerns or they are well-documented in code

**Yggdrasil is likely essential when:**

- The codebase spans many modules with complex interdependencies
- Cross-cutting concerns (security, locking, error handling) must be enforced consistently
- Business processes span multiple services (flows)
- Team members need to understand blast radius before making changes
- The question is "what else is affected?" rather than "how does this work?"

### Recommendations for When to Use Which Approach

1. **Small projects (< 10 modules):** A well-structured README per module + inline comments is sufficient. ADRs for major decisions. Yggdrasil adds overhead without proportional benefit.

2. **Medium projects (10-50 modules):** ADRs + README provide a good foundation. Yggdrasil becomes valuable when cross-cutting concerns multiply and impact analysis becomes non-trivial.

3. **Large projects (50+ modules):** Yggdrasil's structured graph provides the most value here. No amount of READMEs can substitute for machine-traversable aspect propagation, flow participant tracking, and automated drift detection across hundreds of files.

4. **Hybrid approach (recommended):** Use Yggdrasil for cross-module structure AND maintain inline comments for implementation-specific details and known limitations. The experiment shows that Yggdrasil's abstract model benefits from being supplemented with concrete implementation-state awareness.

### Critical Caveat

This experiment tested a best-case scenario for all representations: a well-documented, well-understood module where the person creating each representation had access to the same source material. In real-world conditions, the quality of documentation varies dramatically. Yggdrasil's validation and drift-detection mechanisms provide guardrails that READMEs and comments lack -- they can go stale silently. The experiment measures information content at a point in time, not maintenance burden or staleness risk over time.
