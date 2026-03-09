# Question-Level Analysis — Payload CMS Auth

## Prediction: Which questions would the guided graph answer correctly?

Scoring prediction based on graph content available (not running the actual blindfold evaluation).

### Factual Questions

**F1: Password hashing algorithm and parameters?**
- Prediction: CORRECT. The guided graph captures pbkdf2, 25k iterations, sha256, 512-byte key, timing-safe comparison in strategies/internals.md and strategies/interface.md.

**F2: Three JWT extraction methods and order?**
- Prediction: CORRECT. JWT responsibility.md covers cookie, Bearer, JWT methods and configurable order.

**F3: getEntityPermissions with fetchData=false and Where query?**
- Prediction: CORRECT. Permissions interface.md explicitly covers fetchData=false behavior and the `permission: true` default. The access-control-pattern aspect also documents this known issue.

### Structural Questions

**S1: Login data flow trace?**
- Prediction: PARTIAL. Operations internals has the 20-step flow, but the missing auth-endpoints node means the HTTP entry point is not traced. The evaluator would miss the endpoint-to-operation delegation layer.

**S2: blockReferencesPermissions cache?**
- Prediction: PARTIAL. Permissions internals mentions block reference caching but the guided graph has less detail on the in-place mutation mechanism and cross-entity sharing than the reference.

**S3: Auth operations vs infrastructure session division?**
- Prediction: CORRECT. The session-management aspect and sessions interface clearly document who creates (operations), stores (sessions module), and revokes (operations call sessions).

### Rationale Questions

**R1: Why incrementLoginAttempts operates outside transaction?**
- Prediction: CORRECT. Captured in strategies internals: "parallel login attempts need to see each other's increments immediately."

**R2: Why forgotPassword returns null silently?**
- Prediction: LIKELY CORRECT. Not explicitly in a decision, but the operations interface mentions silent failure. The operations internals does not have a dedicated decision about this (reference does). Partial.

**R3: Why updatedAt = null for session changes?**
- Prediction: CORRECT. Session-management aspect explicitly documents this: "prevent the user profile from appearing modified."

### Impact Questions

**I1: What breaks if pbkdf2 parameters change?**
- Prediction: PARTIAL. The guided graph documents the parameters but doesn't explicitly connect "changing parameters = all existing passwords unverifiable." The strategies node has the detail but impact reasoning requires graph structure the guided graph lacks (no infrastructure node aggregating all consumers).

**I2: What components affected if JWT payload structure changes?**
- Prediction: CORRECT. The relations from operations to jwt and fields-to-sign, plus the strategies node's JWT verification, provide the dependency chain.

**I3: What if Where query cache removed?**
- Prediction: PARTIAL. Permissions internals documents the cache but the guided graph has less detail on the performance implications and the block reference caching interaction.

### Counterfactual Questions

**C1: What if === instead of timingSafeEqual?**
- Prediction: PARTIAL. The guided graph mentions timingSafeEqual in strategies but lacks the timing-safe-comparison aspect that explains WHY constant-time matters and the attack vector. An evaluator would need to infer the timing attack from general knowledge.

**C2: What if incrementLoginAttempts used transaction?**
- Prediction: CORRECT. Clearly explained in both strategies internals and brute-force-protection aspect.

**C3: What if sessions in separate collection?**
- Prediction: PARTIAL. Session-management aspect documents sessions-on-user-document but doesn't capture the rationale for this choice or what would break (block reference caching, atomic updates, no joins needed).

## Score Prediction

| Question | Predicted Score (0-2) | Failure Cause |
|---|---|---|
| F1 | 2 | — |
| F2 | 2 | — |
| F3 | 2 | — |
| S1 | 1 | Missing endpoints node (Phase A gap) |
| S2 | 1 | Insufficient internals depth (Phase E gap) |
| S3 | 2 | — |
| R1 | 2 | — |
| R2 | 1 | No explicit decision entry (Phase D gap) |
| R3 | 2 | — |
| I1 | 1 | Missing impact reasoning (structural gap) |
| I2 | 2 | — |
| I3 | 1 | Insufficient internals depth (Phase E gap) |
| C1 | 1 | Missing timing-safe aspect (Phase B gap) |
| C2 | 2 | — |
| C3 | 1 | Missing decision/rationale (Phase D gap) |

**Predicted total: 23/30**

Assuming reference scores ~28/30 (expert graphs typically score 90%+):

**Predicted E2/E1 ratio: 23/28 = 82%** — above the 80% INVEST threshold.

## Failure-to-Protocol-Phase Mapping

| Phase | Questions Affected | Gap Type |
|---|---|---|
| A (Module Discovery) | S1 | Missing auth-endpoints node — A1/A2 didn't identify the endpoint layer |
| B (Cross-Cutting Patterns) | C1 | Missing timing-safe aspect — B2 should have surfaced this security pattern |
| D (Decision Extraction) | R2, C3 | Missing decisions — D1/D4 didn't target forgotPassword design or session storage choice |
| E (Gap-Filling) | S2, I3 | Insufficient depth on entity-permissions internals — follow-up questions didn't probe deeply enough |

**Weakest phase: D (Decision Extraction)** — only captured 6/19 decisions (32%). The protocol's decision questions were too open-ended and didn't systematically target each design choice visible in the code.

**Second weakest: B (Cross-Cutting Patterns)** — missed 2/5 aspects. The security-oriented patterns (timing-safe, transaction-safety) were missed because the developer didn't volunteer them as "patterns" and the questions didn't specifically ask about security requirements.
