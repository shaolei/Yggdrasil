# Extraction Analysis — Payload CMS Auth

## Summary Statistics

| Metric | Value |
|---|---|
| Total questions asked | 19 (A1-A4: 4, B1-B3: 3, C1-C3: 3, D1-D4: 4, E1-E5: 5) |
| "I don't know" count | 1 (partial: D3 on 20-second window rationale) |
| Most productive phase | Phase A (Module Discovery) — established all nodes and relations |
| Least productive phase | Phase D (Decision Extraction) — only 1 fully novel decision captured |

## Graph Output

| Element | Count |
|---|---|
| Nodes | 9 (auth, operations, strategies, sessions, cookies, jwt, crypto, access-control, permissions, fields-to-sign) |
| Aspects | 4 (hook-lifecycle, access-control-pattern, session-management, brute-force-protection) |
| Flows | 1 (user-authentication) |
| Relations | 6 |
| Aspect exceptions | 4 |
| Decisions captured | 6 |
| "Why NOT" entries | 3 |

## Question ROI Analysis

### Highest-ROI Questions

1. **A3 (Interactions)** — Produced all 6 relations and revealed the dependency structure. Single highest-value question.
2. **B3 (Exceptions to patterns)** — Produced 4 aspect exceptions. These are the details that differentiate expert-level graphs from shallow ones. Specifically: login's non-transactional password check, incrementLoginAttempts' deliberate transaction bypass, logout's simplified hook lifecycle.
3. **A4 (Invisible components)** — Identified the hook lifecycle, access function pipeline, and strategy pipeline as cross-cutting concerns. Directly led to 3 aspects.
4. **C2 (Failure points)** — Produced the parallel brute force scenario, session revocation on error, and the fetchData permission edge case. High-value failure mode documentation.
5. **E5 (Login attempt concurrency)** — Deep technical detail about transaction bypass and atomic increment that would be very hard to discover from code without guidance.

### Lowest-ROI Questions

1. **A2 (File mappings)** — Necessary but mechanical. Could be automated by scanning the filesystem.
2. **D2 (Dual hash for API keys)** — Answer was already in a code comment (TODO). Limited graph value beyond what's in source.
3. **E1 (updatedAt null pattern)** — Confirmed what was already captured in the session-management aspect. Minor incremental value.

### Questions That Should Be Added

- "What configuration options affect this module's behavior?" — Would have systematically captured tokenExpiration, maxLoginAttempts, lockTime, useSessions, loginWithUsername, verify, disableLocalStrategy, cookies config, jwtOrder, etc.
- "Are there any backward compatibility concerns?" — Would have surfaced the SHA-1/SHA-256 API key issue and the fetchData permission TODO more naturally.

## Phase Productivity

| Phase | Graph elements produced | Elements per question |
|---|---|---|
| A: Module Discovery | 9 nodes, 6 relations | 3.75 |
| B: Cross-Cutting Patterns | 4 aspects, 4 exceptions | 2.67 |
| C: Business Processes | 1 flow with 4 paths | 1.67 |
| D: Decision Extraction | 3 decisions, 1 "why NOT" | 1.0 |
| E: Gap-Filling | 2 decisions, 2 "why NOT", enriched 3 artifacts | 1.6 |

Phase A is most efficient per question. Phase D is least efficient but captures the highest-value content (decisions and rejected alternatives).

## Missing Information

The developer could not fully explain:

1. **Why 20 seconds for the session purge window** — "probably just a reasonable window" / "I'd have to look at the PR discussion." This is exactly the kind of decision rationale that is lost without Yggdrasil. Recorded as "rationale: unknown."

2. **Full hook lifecycle for all operations** — Developer described the general pattern and key exceptions but didn't enumerate every hook for every operation (e.g., forgotPassword, resetPassword, verifyEmail). This would require either more targeted questions or reading the source.

3. **Error handling in crypto.ts** — The `this.secret` binding pattern is unusual and the developer mentioned it's legacy code, but couldn't explain why it was designed that way.

4. **Custom strategy integration details** — Developer mentioned custom strategies can be injected but didn't detail how they're registered or ordered relative to built-in strategies.

## Minimum Viable Question Set

The following 10 questions would capture approximately 80% of the graph content:

1. A1 — What are the main components?
2. A3 — Which components interact?
3. A4 — What invisible components exist?
4. B1 — Common patterns across components?
5. B3 — Exceptions to those patterns?
6. C1 — User journey through the area?
7. C2 — What can go wrong?
8. D1 — Why specific design choice? (targeted at most complex behavior)
9. D3 — Non-obvious constraints?
10. E (follow-up) — Concurrency and parallel safety model?

This is under the 15-question INVEST threshold.
