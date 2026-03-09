# Protocol Quality Analysis — Payload CMS Auth

## Efficiency Metrics

| Metric | Value | Assessment |
|---|---|---|
| Total questions asked | 19 | Reasonable |
| Graph elements created | 9 nodes + 4 aspects + 1 flow + 6 relations = 20 | 1.05 elements/question |
| Decisions captured | 6 | 0.32 decisions/question |
| "Why NOT" entries | 3 | 0.16 per question |
| "I don't know" count | 1 (5%) | Very low — simulated developer limitation |
| Redundancy | ~2 questions (A2, E1) produced minimal new content | 11% redundancy |

## Gap Rate

Reference elements NOT discovered by any question:

| Element Type | Reference Count | Discovered | Gap Rate |
|---|---|---|---|
| Nodes | 6 | 5 (missing endpoints) | 17% |
| Aspects | 5 | 3 (missing transaction-safety, timing-safe) | 40% |
| Flows | 3 | 1 (missing password-reset, access-evaluation) | 67% |
| Decisions | 19 | 6 | 68% |
| Relations | 4 unique targets | 3 (missing endpoints relations) | 25% |

**Overall gap rate: ~43%** — significant gaps remain, especially in flows and decisions.

## ROI by Phase

| Phase | Elements Produced | Questions | Elements/Question | Value Assessment |
|---|---|---|---|---|
| A: Module Discovery | 15 (9 nodes + 6 relations) | 4 | 3.75 | HIGHEST efficiency |
| B: Cross-Cutting Patterns | 8 (4 aspects + 4 exceptions) | 3 | 2.67 | HIGH — exceptions are high-value |
| C: Business Processes | 1 flow (4 paths) | 3 | 0.33 | LOW efficiency — too few flows |
| D: Decision Extraction | 4 (3 decisions + 1 "why NOT") | 4 | 1.00 | LOWEST efficiency |
| E: Gap-Filling | 7 (2 decisions + 2 "why NOT" + 3 enrichments) | 5 | 1.40 | MEDIUM — targeted but diminishing returns |

## Highest-ROI Questions

1. **A3 (Component interactions)** — Single most productive question. Established all 6 relations and the dependency graph.
2. **B3 (Pattern exceptions)** — Produced 4 aspect exceptions. These distinguish expert graphs from shallow ones.
3. **A4 (Invisible components)** — Identified cross-cutting concerns that became aspects.
4. **C2 (Failure points)** — Produced the parallel brute force scenario and error handling documentation.

## Lowest-ROI Questions

1. **A2 (File mappings)** — Mechanical; should be automated.
2. **D2 (Specific design choice)** — Answer was already in code comment.
3. **E1 (updatedAt null)** — Confirmed existing content.

## Minimum Viable Question Set

From extraction-analysis.md, the proposed 10-question set:

1. A1 — What are the main components?
2. A3 — Which components interact?
3. A4 — What invisible components exist?
4. B1 — Common patterns across components?
5. B3 — Exceptions to those patterns?
6. C1 — User journey through the area?
7. C2 — What can go wrong?
8. D1 — Why specific design choice?
9. D3 — Non-obvious constraints?
10. E (follow-up) — Concurrency and parallel safety model?

**Assessment**: 10 questions is under the 15-question INVEST threshold. This set would capture approximately 80% of the graph content that was actually captured, but the 43% gap rate means it would capture ~46% of the reference graph content. The set is efficient for what it asks but misses entire categories:

### Missing from Minimum Viable Set

- **No flow diversity question**: C1 asks for "a" user journey (singular). Should ask for ALL key user journeys to discover password-reset and access-evaluation flows.
- **No security-specific question**: Timing-safe comparison and transaction safety were missed because no question targets security patterns specifically.
- **No configuration question**: What config options affect behavior? Would systematically discover tokenExpiration, maxLoginAttempts, lockTime, useSessions, etc.
- **No backward compatibility question**: Would have surfaced SHA-1/SHA-256 API key issue.

### Recommended Additions

Add these to reach ~80% of reference content:

11. "What other end-to-end processes exist beyond the main one?" (catches password-reset, access-evaluation flows)
12. "What security-sensitive operations exist and what protections are in place?" (catches timing-safe, transaction-safety aspects)
13. "What configuration options change behavior?" (systematic config discovery)

This gives a 13-question set — still under the 15-question threshold.

## Follow-up Necessity

- 5 follow-up questions were asked (Phase E)
- These produced 2 decisions, 2 "why NOT" entries, and enriched 3 artifacts
- Phase E accounted for ~18% of total graph content
- **Conclusion**: Follow-ups are valuable but show diminishing returns after round 1. The recommended max of 2 rounds is appropriate.

## Protocol Weaknesses

1. **Decision extraction is too open-ended**. Asking "why was it done this way?" yields shallow answers. The protocol should provide specific design choices observed in code and ask about alternatives directly. E.g., "I see pbkdf2 is used instead of bcrypt. Was that deliberate?"

2. **Business process questions assume a single journey**. C1 asks for "a typical user journey" — should ask "what are the KEY user journeys" (plural) to discover multiple flows.

3. **No security-specific phase**. Security patterns (timing-safe, transaction isolation) are cross-cutting but won't emerge from generic "pattern" questions. A dedicated security question would catch these.

4. **A2 (file mappings) should be automated**. The extraction agent could scan the filesystem instead of asking the developer.

5. **Simulated developer bias**: The simulated developer answered consistently and completely. Real developers would likely say "I don't know" more often, reducing the 5% "I don't know" rate and the overall graph quality.
