# Question-Level Analysis: Would the Guided Graph Answer Correctly?

## Prediction Method

For each question, I assess whether the guided graph's content package contains sufficient information to answer correctly, and predict PASS/PARTIAL/FAIL.

## Factual Questions

### F1: Three lazy properties on Request and what each triggers

**Prediction: PASS**

The guided graph's lazy-evaluation aspect and request interface.md explicitly list `user`/`auth` triggering `_authenticate()`, `data` triggering `_load_data_and_files()`, and `stream` triggering `_load_stream()`. Complete coverage.

### F2: All built-in authentication classes and credential sources

**Prediction: PASS**

Authentication interface.md lists all four classes (Basic, Session, Token, RemoteUser) with their credential sources. Complete.

### F3: SimpleRateThrottle.allow_request() algorithm step by step

**Prediction: PASS**

Throttling internals.md describes the sliding window algorithm in 4 steps (get history, remove expired, check count, insert). Sufficient for a correct answer.

## Structural Questions

### S1: Complete method call sequence from Django routing to handler

**Prediction: PASS**

APIView interface.md and internals.md describe dispatch -> initialize_request -> initial -> handler. Flow description also covers this. The guided graph has this well-documented.

### S2: How authentication state flows from Authentication through Request to APIView

**Prediction: PARTIAL**

The guided graph captures that authenticators return (user, auth), Request caches them, and APIView forces auth via `perform_authentication()`. But it misses that `_request.user` is also set (for middleware compatibility) and the `successful_authenticator` property's role in the flow. The reference's request interface.md has more detail on user setter behavior.

**Missing from**: request interface.md (user setter sets `_request.user`). Protocol phase: A3 (interactions) should have caught this bidirectional flow.

### S3: How & and | operators work on permission classes

**Prediction: PARTIAL**

The guided graph captures OR object permission semantics well (re-checks has_permission) in permissions interface.md and internals.md. But operator-composition is NOT an aspect, so the mechanics of `OperationHolderMixin`, `OperandHolder`, `SingleOperandHolder`, and metaclass-based operator support are missing. An evaluator would get the behavioral result but not the implementation mechanism.

**Missing from**: operator-composition aspect (not created). Protocol phase: B1/B2 identified the pattern but extraction agent didn't create a dedicated aspect.

## Rationale Questions

### R1: Why SessionAuthentication.enforce_csrf() raises PermissionDenied instead of AuthenticationFailed

**Prediction: PASS**

Authentication internals.md explicitly captures this decision: "SessionAuthentication returns 403, not 401" and the CSRF split decision. The guided graph states: browsers show native auth dialog on 401, wrong for session auth.

### R2: Why csrf_exempt is applied in as_view() rather than dispatch()

**Prediction: PASS**

APIView internals.md captures this: "csrf_exempt is applied in as_view() rather than on dispatch() to prevent accidental removal when dispatch is overridden."

### R3: Why Request uses WrappedAttributeError

**Prediction: PASS**

Request internals.md and the lazy-evaluation aspect both capture this: Python's descriptor protocol silently swallows AttributeError from @property getters, making debugging impossible.

## Impact Questions

### I1: What breaks if authenticate() returns 3-tuple instead of 2-tuple

**Prediction: PARTIAL**

The guided graph shows Request's `_authenticate` expects `(user, auth)` tuple (request internals.md). It would correctly identify Request breakage. But it lacks the explicit `consumes` detail on the api-view -> authentication relation (guided says `BaseAuthentication` not `authenticate, authenticate_header`), and has no `failure` field on relations. An evaluator would get the basic answer but miss some downstream effects.

**Missing from**: relation failure details. Protocol phase: A3 asked about interactions but not about what specifically breaks.

### I2: What breaks if perform_authentication() is removed from initial()

**Prediction: PASS**

The guided graph's flow and lazy-evaluation aspect clearly document that perform_authentication forces eager auth, and without it auth would be lazy. Permissions depend on request.user. The evaluator can trace this: permissions would fail or see AnonymousUser.

### I3: What is lost if SimpleRateThrottle uses counter instead of timestamp list

**Prediction: PASS**

Throttling internals.md explicitly discusses "sliding window over fixed window" and the wait time calculation that depends on individual timestamps. An evaluator can derive that accurate wait-time calculation and burst-at-boundary protection would be lost.

## Counterfactual Questions

### C1: What if DjangoObjectPermissions returned 403 instead of 404 for no-read-permission

**Prediction: PASS**

Permissions internals.md explicitly captures the 404 masking decision and rationale: "prevents leaking information about whether the object exists to unauthorized users." The counterfactual follows directly.

### C2: What if Request.__init__ eagerly called _authenticate()

**Prediction: PASS**

The lazy-evaluation aspect and the "Exception: Eager Forcing" section in the guided graph provide rich context. The guided graph even notes that views can override `perform_authentication()` to restore lazy behavior. An evaluator can derive: authentication would happen before APIView sets up the pipeline, before content negotiation, and before exception handling is ready.

### C3: Why OR.has_object_permission doesn't simply return op1 or op2

**Prediction: PASS**

Permissions internals.md explicitly covers this: "if permission A denied view-level access but permission B granted it, only B's object-level check should apply. Without the re-check, A's object permission could grant access despite A's view-level denial."

## Summary

| Category | Pass | Partial | Fail | Total |
|---|---|---|---|---|
| Factual (F1-F3) | 3 | 0 | 0 | 3 |
| Structural (S1-S3) | 1 | 2 | 0 | 3 |
| Rationale (R1-R3) | 3 | 0 | 0 | 3 |
| Impact (I1-I3) | 2 | 1 | 0 | 3 |
| Counterfactual (C1-C3) | 3 | 0 | 0 | 3 |
| **Total** | **12** | **3** | **0** | **15** |

## Predicted Score

Using scoring: PASS=full marks, PARTIAL=half marks, FAIL=0:
- Predicted: 12 + 1.5 = **13.5 / 15 = 90%** of maximum

Compared to reference (assuming ~100% answerable): guided achieves **~90%** of reference question coverage.

## Failure Analysis: What Caused Partial Scores

| Question | Root Cause | Missing Element | Protocol Phase Gap |
|---|---|---|---|
| S2 | Missing user setter bidirectional flow | request interface.md detail | A3 (interactions) - didn't probe bidirectional state propagation |
| S3 | No operator-composition aspect, missing metaclass mechanics | aspect + internals detail | B1/B2 identified pattern but didn't create separate aspect |
| I1 | No failure details on relations, less specific consumes | relation metadata | A3 - didn't ask about failure modes of interactions |

## Key Insight

The guided graph's strengths are in rationale and counterfactual questions (6/6 pass) because the extraction protocol's Phase D and Phase C captured decisions and constraints well. The weaknesses are in structural trace questions (S2, S3) and impact questions (I1) where precise interface details and relation metadata matter. This suggests the protocol should add specific questions about:
1. Data flow directions (what does each component set vs read?)
2. Failure modes of component interactions
3. Implementation mechanism details for cross-cutting patterns
