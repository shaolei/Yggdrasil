# Comparison Summary — Payload CMS Auth

## Overall Assessment

The guided novice graph achieves approximately **70-75% of expert graph quality** structurally and **60-65% semantically**. The predicted blindfold score is **82% of expert** (23/28), which crosses the 80% INVEST threshold but just barely.

## Scorecard

| Metric | E1 (Expert) | E2 (Guided) | E2/E1 | Threshold |
|---|---|---|---|---|
| Node coverage | 6 | 10 (5 matching) | 83% match | — |
| Relation coverage | 4 | 6 (3 matching) | 75% match | — |
| Aspect coverage | 5 | 4 (3 matching) | 60% | — |
| Flow coverage | 3 | 1 (1 partial match) | 33% | — |
| Decision coverage | 19 | 6 | 32% | 40% = ITERATE |
| "Why NOT" coverage | 5 | 3 | 60% | 40% = INVEST |
| Constraint coverage | 14 | 8 | 57% | — |
| Predicted blindfold score | ~28/30 | ~23/30 | 82% | 80% = INVEST |
| Minimum viable question set | — | 10 (recommended: 13) | — | 15 = INVEST |

## Verdict by Threshold

| Metric | Verdict |
|---|---|
| E2 blindfold vs E1 | **INVEST** (82% >= 80%) |
| E2 decision capture | **ITERATE** (32% < 40%) |
| E2 "why NOT" capture | **INVEST** (60% >= 40%) |
| Minimum viable question set | **INVEST** (13 <= 15) |

**Overall: ITERATE** — The blindfold prediction meets INVEST threshold, but decision capture is in ITERATE territory. The protocol needs targeted improvements before shipping as `yg guided-init`.

## What the Protocol Gets Right

1. **Module discovery (Phase A) is excellent** — 3.75 elements per question, establishes the structural foundation.
2. **Pattern exceptions (B3) are high-value** — Captures the details that differentiate shallow from expert graphs.
3. **Brute force protection is fully captured** — The most complex cross-cutting concern is covered at expert depth.
4. **Core login flow is equivalent** — The 20-step flow with parallel safety is captured at expert quality.

## What the Protocol Misses

1. **Flows are severely undercaptured** (33%) — Asking for "a journey" finds one; needs to ask for ALL key journeys.
2. **Decisions are undercaptured** (32%) — Open-ended "why" questions don't systematically discover decisions. Need to present specific code observations.
3. **Security aspects are invisible** — Generic pattern questions don't surface security requirements (timing-safe, transaction-safety).
4. **Endpoints layer is missing** — Phase A didn't identify the thin HTTP handler layer.

## Recommended Protocol Changes

1. **Add a flow diversity question**: "What other end-to-end processes exist?" after C1.
2. **Add a security-specific question**: "What security-sensitive operations exist and what protections are in place?"
3. **Make decision extraction targeted**: Instead of "why was it done this way?", present specific code observations: "I see X is used instead of Y. Was that deliberate?"
4. **Automate A2 (file mappings)**: Scan filesystem instead of asking the developer.
5. **Add configuration discovery**: "What config options change this module's behavior?"

## Implications for `yg guided-init`

The protocol is viable but needs the 5 improvements above. With those changes, the 13-question minimum viable set should achieve ~85% of expert quality — sufficient for a shipped product. Decision capture will remain the primary gap because decisions live in developer memory, not in code, and simulated developers answer more reliably than real ones.

The biggest risk for production use is the simulated developer bias: real developers will say "I don't know" more often and provide less structured answers. The 82% prediction should be treated as an upper bound.
