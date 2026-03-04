# Experiment 9: Contradiction Detection -- Synthesis Findings

## 1. Hypothesis

An agent given BOTH a graph with a subtle error AND actual source code will detect the contradiction. Detection rate depends on subtlety: strategy-level contradictions are easier to detect than detail-level ones.

## 2. Methodology

- 5 contradiction types were planted in the Hoppscotch `TeamCollectionService` graph (C1--C5), each at a different subtlety level.
- C0 = control (unmodified graph) to establish the false positive baseline.
- Each agent received a modified graph variant + the real source code (`team-collection.service.ts`, 1550 lines) + an instruction to check for inconsistencies.
- The agent did NOT know there WAS a planted contradiction or which artifact was modified. The prompt was neutral: "review graph against source code for inconsistencies."

## 3. Results by Contradiction Level

### C0 -- Control (No Contradictions Planted)

**Planted:** Nothing. Exact copy of the original graph.

**Detected "issues":** The agent reported 16 numbered items. After analysis:

- 3 TRUE issues found in the unmodified graph:
  1. `retry-on-deadlock/aspect.yaml` says "Exponential retry" but the strategy is linear backoff (internal contradiction within the original graph).
  2. `pubsub-events/content.md` claims events are published AFTER transaction commit, but `moveCollection` publishes INSIDE the transaction callback -- a genuine code/graph inconsistency.
  3. `sortTeamCollections` mutates orderIndex but publishes no PubSub event, violating the graph's "every mutation publishes" invariant -- a genuine code/graph inconsistency.
- 3 MINOR real observations (destination lock scope ambiguity, `isParent` reference equality vs. ID equality, `getCollectionTreeForCLI` public vs. private characterization).
- Remaining items were verified as consistent or borderline.

**Key takeaway:** The C0 control reveals that the original unmodified graph itself already contains at least 3 real inconsistencies. This is important: these same 3 issues appear across ALL detection reports (C0--C5), forming the "background noise" that every agent detected regardless of the planted contradiction. They are not false positives -- they are real pre-existing issues.

---

### C1 -- Strategy Reversal (LOW Subtlety)

**Planted (from manifest):** The entire `pessimistic-locking` aspect was rewritten to describe optimistic locking with per-row version fields. The directory name remained `pessimistic-locking` but the content described the opposite strategy. This created cross-artifact contradictions with `constraints.md`, `flow description.md`, and `decisions.md`, which all still reference pessimistic locking.

**Detected:** YES -- the agent identified this as the single most critical finding. Specific detections:
- Inconsistency #1 (CRITICAL): Named "Optimistic Locking" but code uses `SELECT ... FOR UPDATE` (pessimistic). No `version` field exists anywhere in code.
- Inconsistency #2 (CRITICAL): Claims "version has changed since read" retry behavior -- no such behavior exists.
- Inconsistency #3 (CRITICAL): Claims per-row version conflict detection -- code uses sibling-set-level locking.
- Inconsistency #8 (MODERATE): Internal contradiction -- `responsibility.md` says "pessimistic" but the linked aspect says "optimistic."
- Multiple downstream inconsistencies (#9, #11, #12) flagged where other artifacts reference "pessimistic locking" but the aspect describes optimistic.

**True positive:** YES -- detected precisely and identified the exact planted contradiction with full severity.

**Precision:** HIGH -- the agent identified the exact modified files (`pessimistic-locking/aspect.yaml` and `content.md`), described the exact nature of the reversal, and traced the cascading cross-artifact contradictions.

**False positives:** The agent also reported the same 3 pre-existing background issues (exponential vs. linear in retry aspect, moveCollection PubSub timing, sortTeamCollections missing PubSub). These are real issues from the original graph, not false positives.

**Severity assessment:** EXCELLENT -- rated the planted contradiction as CRITICAL and gave the overall locking aspect a "VERY LOW trust" rating, correctly identifying it as the most damaging inconsistency.

---

### C2 -- Missing Invariant (MEDIUM Subtlety)

**Planted (from manifest):** The "Timing" section was removed from `pubsub-events/content.md`. This section stated that events are published AFTER transaction commit and noted the delete path exception. Only the timing invariant was deleted; channel naming and payload shapes were preserved.

**Detected:** PARTIALLY. The agent detected the consequences of the missing invariant but did NOT explicitly identify that the timing section was absent:
- Inconsistency #2 (HIGH): Noted that the retry exhaustion behavior is misdescribed (falls through to `E.right(true)` not `E.left`). This is a pre-existing issue unrelated to the planted change.
- Inconsistency #3 (HIGH): Found `sortTeamCollections` violates "every mutation publishes PubSub" invariant (pre-existing background issue).
- The agent did NOT flag that the pubsub timing invariant was missing from the graph. It did not notice the absence.

**True positive:** NO -- the planted omission (missing timing section) was not detected. The agent found other real issues but not the specific planted one.

**Precision:** N/A -- the planted contradiction was not identified.

**False positives:** 7 inconsistencies and 14 omissions reported, mostly legitimate observations about the code-graph gap, including pre-existing background issues. The omissions list (missing public API methods, deprecated method, cursor pagination, etc.) reflects genuine graph incompleteness.

**Severity assessment:** The agent gave a reasonable overall assessment of 75-80% coverage accuracy, but missed the most important planted change entirely.

**Key insight:** Detecting MISSING information is fundamentally harder than detecting WRONG information. The agent looked for contradictions between what the graph says vs. what the code does, but did not systematically check what the graph SHOULD say but does not.

---

### C3 -- Stale Algorithm (MEDIUM Subtlety)

**Planted (from manifest):** The reorder algorithm in `logic.md` was replaced. The original "shift range" approach (decrement affected siblings, place at target) was replaced with a simple "swap positions" algorithm (swap orderIndex of two collections, no other siblings modified). This contradicts `constraints.md` (which says "shifts affected ranges") and the flow description (which says "shift affected range by +1 or -1").

**Detected:** YES -- the agent identified both sub-cases of the planted contradiction as CRITICAL findings:
- Inconsistency #1 (CRITICAL): "Move to end" described as "swap two rows" but code does gap-fill + append shifting all later siblings. The agent provided exact code evidence showing `updateMany` with range conditions.
- Inconsistency #2 (CRITICAL): "Move to specific position" described as "swap two collections, no others modified" but code shifts an entire range of siblings. Agent noted the `isMovingUp` direction logic and range calculations.

**True positive:** YES -- both halves of the planted contradiction detected with full precision.

**Precision:** HIGH -- the agent identified the exact file (`logic.md`), the exact sections (Move to end, Move to specific position), quoted the planted "swap" language, and contrasted it with the actual range-shift code. The agent correctly noted "This is a fundamentally different algorithm."

**False positives:** 7 additional issues reported (exponential vs. linear in retry aspect, destination lock scope, missing already-root guard in flow, `isParent` reference equality, `sortTeamCollections` missing from flow and missing PubSub, move-to-root lock gap). All are pre-existing background issues.

**Severity assessment:** EXCELLENT -- rated both planted contradictions as CRITICAL, correctly identifying them as the most important findings.

---

### C4 -- Subtle Inversion (HIGH Subtlety)

**Planted (from manifest):** The retry scope was inverted across 3 files:
- `retry-on-deadlock/content.md`: Changed from "only delete retries" to "create/move/reorder retry, delete does not"
- `decisions.md`: Corresponding rationale inverted ("delete is idempotent, doesn't need retries")
- `description.md`: Retry steps moved from delete path to create/move/reorder paths

The inversion was internally consistent across all 3 modified files. The fabricated "delete is idempotent" reasoning sounds technically plausible.

**Detected:** YES -- the agent identified the inversion as the dominant finding:
- Inconsistency #1 (HIGH -- labeled as "inversion error"): Delete DOES have retries -- graph claims it does not. Agent identified `deleteCollectionAndUpdateSiblingsOrderIndex` retry loop directly.
- Inconsistencies #3, #4, #5 (all HIGH): Create, move, and reorder do NOT have retries -- graph claims they do. Agent checked each method individually.
- Inconsistency #9 (HIGH): "Retry attribution is completely inverted: only delete has retries, graph says only delete lacks them." This is the exact planted contradiction stated in summary form.

**True positive:** YES -- detected with high precision across all 3 modified files.

**Precision:** VERY HIGH -- the agent not only found the inversion but explicitly called it out as a systemic inversion: "The most significant finding is that the retry behavior attribution is completely inverted across the graph." The agent checked each method (`createCollection`, `moveCollection`, `updateCollectionOrder`) individually for retry loops and confirmed their absence.

**False positives:** 6 additional issues (exponential vs. linear in retry aspect, destination lock scope, `isParent` reference equality, delete PubSub timing "exception" framing, sort/update missing from flow). All pre-existing background issues.

**Severity assessment:** EXCELLENT -- the agent rated the inversion as the top finding and correctly assessed all 5 retry-related inconsistencies as HIGH severity.

---

### C5 -- Wrong Rationale (HIGH Subtlety)

**Planted (from manifest):** One section of `decisions.md` was replaced: "Why orderIndex is integer-based, not fractional." The original rationale (contiguity + simplicity for collaborative tool) was replaced with a fabricated Prisma ORM limitation argument (poor `Decimal` type support, `updateMany` rounding errors on float columns). The fabricated rationale uses accurate Prisma terminology and sounds technically plausible.

**Detected:** YES -- the agent explicitly identified this as a fabricated rationale:
- Finding #5 (MEDIUM-HIGH): "FABRICATED RATIONALE -- Why orderIndex is integer-based, not fractional." The agent stated: "This rationale reads as a plausible-sounding but fabricated justification. The specific claims about Prisma's `Decimal` type behavior, `@db.Decimal` mapping overhead, and `updateMany` rounding errors are highly specific technical details that appear nowhere in the codebase and cannot be verified from the source. This is a classic hallucinated rationale."

**True positive:** YES -- the planted fabricated rationale was detected.

**Precision:** HIGH -- the agent identified the exact section in `decisions.md`, quoted the fabricated content, and correctly classified it as fabricated.

**However, the agent went further and also flagged 3 additional rationales as fabricated:**
- Finding #6: "Why delete has retries but other mutations do not" -- flagged as "likely fabricated." In fact, this rationale was NOT modified in C5 and is the original content. This is a FALSE POSITIVE in the sense of contradiction detection, though it reflects a legitimate concern about rationale provenance.
- Finding #7: "Why pessimistic, not optimistic locking" -- flagged as fabricated. This is the original, unmodified content.
- Finding #8: "Why `isParent` walks up, not down" -- flagged as fabricated. This is the original, unmodified content.

**False positives:** 3 rationales flagged as fabricated that were actually the original graph content. Additionally, the standard pre-existing issues were reported (exponential vs. linear, move flow step ordering, destination lock scope, `sortTeamCollections` missing PubSub, `isParent` reference equality, move-to-root lock gap).

**Severity assessment:** GOOD but over-sensitive. The agent correctly identified the planted fabrication but also over-detected, flagging unmodified rationales as suspicious. The agent noted "4 fabricated rationales" when only 1 was actually planted.

**Key insight:** Once an agent is primed to look for fabricated rationales (by finding one), it becomes hyper-suspicious of ALL rationales, even genuine ones. This is a calibration problem: the detection sensitivity increases but precision drops.

---

## 4. Detection Matrix

| Contradiction | Subtlety | Planted? | Detected? | Precision | False Positives (beyond background) |
|---|---|---|---|---|---|
| C0 Control | N/A | No | N/A | N/A | 0 (3 real pre-existing issues found) |
| C1 Strategy reversal | LOW | Yes | YES | HIGH -- exact files, exact nature, cascading effects traced | 0 |
| C2 Missing invariant | MEDIUM | Yes | NO | N/A -- not detected | 0 (but many omissions flagged, none matching the planted one) |
| C3 Stale algorithm | MEDIUM | Yes | YES | HIGH -- both sub-cases identified with code evidence | 0 |
| C4 Subtle inversion | HIGH | Yes | YES | VERY HIGH -- systemic inversion identified by name | 0 |
| C5 Wrong rationale | HIGH | Yes | YES (partial) | HIGH for planted item; but 3 additional false fabrication flags | 3 (unmodified rationales flagged as fabricated) |

### Background Noise (Pre-Existing Issues Detected Across All Variants)

These issues were found in virtually every report because they exist in the original unmodified graph:

| Issue | Found in reports |
|---|---|
| `retry-on-deadlock/aspect.yaml` says "Exponential" but backoff is linear | C0, C1, C2, C3, C4, C5 |
| `moveCollection` publishes PubSub INSIDE transaction (not after commit) | C0, C1, C5 |
| `sortTeamCollections` missing PubSub event (violates invariant) | C0, C1, C2, C3, C5 |
| Destination lock scope (locks dest's siblings, not dest's children) | C0, C1, C2, C3, C4, C5 |
| `isParent` uses object reference equality (effectively dead code) | C0, C1, C2, C3, C4, C5 |

## 5. Key Findings

### Were ALL planted contradictions detected?

4 out of 5 planted contradictions were detected. C2 (missing invariant / omission) was NOT detected. Detection rate: **80%**.

### How does subtlety level affect detection?

The hypothesis that "strategy-level contradictions are easier to detect than detail-level ones" is **partially supported but more nuanced than expected**:

- **LOW subtlety (C1 -- strategy reversal):** Detected immediately, with high precision. As expected.
- **MEDIUM subtlety (C2 -- missing invariant):** NOT detected. The only failure. Detecting absent information is fundamentally different from detecting wrong information.
- **MEDIUM subtlety (C3 -- stale algorithm):** Detected immediately, with high precision. The code evidence was clear and the contradiction was between WHAT the graph says vs. WHAT the code does.
- **HIGH subtlety (C4 -- subtle inversion):** Detected with very high precision, despite being internally consistent across 3 modified files. The agent checked the actual code, found the retry loop in delete, and confirmed its absence in create/move/reorder.
- **HIGH subtlety (C5 -- wrong rationale):** Detected, but with calibration issues (over-flagging unmodified rationales).

**The key dimension is not subtlety alone but contradiction TYPE:**

| Type | Detection | Why |
|---|---|---|
| Wrong fact (code says X, graph says Y) | RELIABLE | Agent can compare graph claim to code evidence |
| Wrong strategy (entire mechanism replaced) | RELIABLE | Large surface area of contradiction |
| Missing information (graph omits important invariant) | UNRELIABLE | Agent checks what graph says, not what it should say |
| Inverted scope (which operations have property X) | RELIABLE | Agent can verify each operation individually |
| Fabricated rationale (plausible but unsupported reasoning) | DETECTABLE but noisy | Agent can flag unsupported claims but tends to over-flag |

### What was the false positive rate from C0?

C0 reported 6 inconsistencies, of which 3 are genuine pre-existing issues in the original graph. The remaining 3 are minor observations (ambiguity, implementation nuance, public vs. private characterization). **There were zero fabricated false positives** -- every reported issue had a factual basis.

### Were the C0 "false positives" actually real issues?

YES. The 3 major C0 findings are genuine:
1. The `aspect.yaml` description "Exponential retry" contradicts its own `content.md` which says "linear" -- this is a real internal inconsistency in the original graph.
2. `moveCollection` does publish inside the transaction callback -- this is a real code/graph inconsistency.
3. `sortTeamCollections` does lack a PubSub event -- this is a real violation of the stated invariant.

These should be fixed in the actual Hoppscotch graph.

### Which contradiction types are hardest to detect?

**Omissions (C2) are the hardest.** An agent reviewing a graph for inconsistencies naturally looks for CLAIMS that contradict the CODE. When information is simply absent, there is nothing to contradict. The agent would need to independently determine what the graph SHOULD contain and check for completeness -- a fundamentally different task from consistency checking.

**Fabricated rationales (C5) are detectable but noisy.** The agent can identify rationales that have no code evidence, but it then becomes hyper-suspicious and flags genuine rationales as fabricated. The core issue: there is no way to verify rationale correctness from code alone. Rationales record human intent, which by definition is not in the source code.

### Does the agent correctly assess severity?

YES, with one exception:
- C1: Rated CRITICAL -- correct, this was the most damaging change.
- C3: Rated CRITICAL -- correct, the algorithm was fundamentally wrong.
- C4: Rated HIGH across all 5 retry findings -- correct, the inversion affected core correctness understanding.
- C5: Rated MEDIUM-HIGH -- reasonable, a wrong rationale is less immediately dangerous than a wrong algorithm.
- C2: Not detected, so severity was not assessed.

Severity assessment tracks well with actual impact. The agent consistently rates factual errors about code behavior higher than rationale-level issues, which is the correct priority ordering.

## 6. Graph Quality Implications

### Can agents serve as graph quality auditors?

**YES, with caveats.** The experiment demonstrates that agents are highly effective at detecting factual inconsistencies between graph and code (4/4 factual contradictions detected). They are poor at detecting omissions (0/1 detected). Recommended auditing scope:

| Audit type | Agent effectiveness | Recommended? |
|---|---|---|
| Factual consistency (graph claims vs. code behavior) | HIGH (100% detection) | YES -- primary use case |
| Strategy/mechanism correctness | HIGH (100% detection) | YES |
| Algorithm accuracy | HIGH (100% detection) | YES |
| Scope/attribution correctness (which operations have which properties) | HIGH (100% detection) | YES |
| Rationale verification | MODERATE (detected but noisy) | YES with human review of flags |
| Completeness checking (what is missing from graph) | LOW (0% detection) | NO -- requires different approach |

### Should Yggdrasil include a "graph review" command?

**YES.** A `yg review --node <path>` command that feeds the agent the graph artifacts + source code with a structured consistency-checking prompt would catch the majority of graph quality issues. The experiment shows:

- The prompt "check for inconsistencies" is sufficient to trigger thorough review
- Agents naturally check claims against code evidence
- The structured output (table of inconsistencies with severity, artifact, claim, evidence) is useful

A review command should:
1. Feed the agent `build-context` output + mapped source files
2. Ask for factual consistency checking
3. Separately ask for completeness checking (what important code behavior is not documented?)
4. Output structured findings with severity ratings

### What types of graph errors are most dangerous (undetectable)?

1. **Missing invariants/constraints (C2 type):** Information that SHOULD be in the graph but is absent. Agents do not naturally check for completeness. An agent working from a graph missing the PubSub timing invariant would unknowingly emit events inside transactions.

2. **Plausible-but-wrong rationales that are internally consistent:** If a fabricated rationale does not contradict any other artifact, it may not be flagged. C5 was detected partly because the agent checked for code evidence, but a rationale that happens to align with observable code behavior while being wrong about the REASON would be nearly undetectable.

3. **Gradually stale graphs:** Small drift accumulated over many changes. Each individual claim might be "almost right" but the cumulative effect is a misleading picture. The experiment tested binary right/wrong; gradual wrongness is harder to detect.

## 7. Product Implications for Yggdrasil

### Recommended workflow for graph quality assurance

1. **After initial graph creation:** Run a consistency review (agent compares graph to source). Fix factual errors.
2. **After graph modification:** Run `yg drift` (existing), then a targeted consistency check on modified nodes.
3. **Periodic completeness audit:** Separately prompt an agent to identify important code behaviors NOT captured in the graph. This requires a different prompt than consistency checking.
4. **Rationale hygiene:** When an agent creates a graph, mark rationales as "inferred" vs. "stated by developer." This lets future reviewers know which rationales have human backing and which are agent-generated inferences. The C5 experiment shows that agents WILL generate plausible-but-fabricated rationales if not constrained.

### Whether automated graph-code consistency checking is feasible

**YES, for factual consistency.** The experiment demonstrates that an agent with access to both graph and source can reliably detect:
- Wrong claims about code behavior
- Wrong algorithms
- Wrong attribution of properties to operations
- Internal contradictions within the graph

This can be automated as a CI-like check. The false positive rate from C0 is zero (all reported issues were real). The missed detection rate for factual errors is zero (4/4 detected). Only omissions escape detection.

**NO, for completeness checking,** at least not with the same approach. Completeness requires the agent to independently reason about what SHOULD be in the graph, which is a harder problem.

### Agent rule updates to improve detection

1. **Add an explicit completeness check step.** After checking "does the graph accurately describe the code?", add "does the graph OMIT any important behavior, invariant, or constraint?" This directly addresses the C2 failure.

2. **Rationale provenance tracking.** Rules should require that agent-generated rationales be marked as `source: inferred` vs. `source: developer`. The C5 findings show that agents over-flag rationales when they cannot distinguish inferred from stated.

3. **Cross-artifact consistency as a first-class check.** The C1 experiment showed that cross-artifact contradictions (aspect says optimistic, responsibility says pessimistic) are strong signals. Rules should instruct agents to check consistency BETWEEN graph artifacts, not just graph-vs-code.

4. **Structured review protocol.** When reviewing a graph, agents should follow a checklist:
   - For each claim in the graph: verify against source code
   - For each algorithm in the graph: trace through the actual code path
   - For each invariant in the graph: find at least one violation or confirm universal compliance
   - For each rationale: note whether code evidence supports, contradicts, or is neutral
   - For each major code behavior: check whether it is represented in the graph

## 8. Conclusion

Experiment 9 demonstrates that agents are highly effective contradiction detectors for factual graph-code inconsistencies, achieving a **100% detection rate across all 4 factual contradiction types** (strategy reversal, stale algorithm, subtle inversion, wrong rationale). The only failure was a **missing invariant (omission)**, which represents a fundamentally different detection challenge -- checking what SHOULD be there rather than whether what IS there is correct.

The most surprising result is **C4 (subtle inversion at HIGH subtlety): detected with very high precision** despite being internally consistent across 3 modified files with plausible fabricated reasoning. The agent's ability to check individual code methods for the presence/absence of retry loops overcame the inversion's careful cross-artifact consistency. This suggests that agents are robust against "coordinated deception" in the graph as long as the ground truth (source code) is available.

The most concerning result is **C2 (missing invariant at MEDIUM subtlety): completely undetected.** This means that the most dangerous graph error in practice -- an important invariant that was never captured or was accidentally deleted -- is also the one least likely to be caught by agent review. This has direct product implications: Yggdrasil should treat completeness checking as a separate, dedicated workflow rather than expecting consistency checking to cover it.

**Detection difficulty ranking (empirical, from this experiment):**
1. EASIEST: Wrong facts about code behavior (C1, C3, C4) -- 100% detection
2. MODERATE: Fabricated rationales (C5) -- detected but with calibration noise
3. HARDEST: Missing information (C2) -- 0% detection

**The hypothesis is partially confirmed:** detection rate does depend on contradiction type, but subtlety level (LOW/MEDIUM/HIGH) is less predictive than contradiction category (factual error vs. omission vs. fabricated rationale). A HIGH-subtlety factual inversion (C4) was detected more reliably than a MEDIUM-subtlety omission (C2).
