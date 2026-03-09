# Experiment Series 5: Invisibility

## Goal

Validate that Yggdrasil can become invisible to developers: automatic graph construction,
automatic maintenance, automatic context delivery. The developer writes code; the graph
lives in the background.

## Status

| Experiment | Status | Key Metric | Result |
|---|---|---|---|
| 5.1 Auto-construct from git | **COMPLETE** | Structural 100%/59%/56%, semantic 96%/59%/64% | **ITERATE** |
| 5.2 Incremental from PRs | **COMPLETE** | Precision 100%, recall 81%, 0% FP | **INVEST** |
| 5.3 Zero-prompt delivery | **COMPLETE (pilot)** | Lazy injection: 97.5% of manual | **INVEST** |
| 5.4 Intent-based selection | **COMPLETE** | S1: precision 89%, recall 96% | **INVEST** |
| 5.5 Non-expert quality | **COMPLETE** | Guided novice: 82-90% of expert | **INVEST** |
| Synthesis | **COMPLETE** | See synthesis.md | 4 INVEST + 1 ITERATE |

## Repos Used

| Repo | Language | Target Area | Lines |
|---|---|---|---|
| django-rest-framework | Python | Request processing pipeline | 1,772 |
| caddyserver/caddy | Go | Reverse proxy module | ~6,500 |
| payloadcms/payload | TypeScript | Auth & access control | 5,481 |

All repos at `/home/node/experiments/`.

## Execution Order (Actual)

```
Phase 1 (parallel): ✅ DONE
  5.1 Auto-construct × 3 repos
  5.5 Guided novice × 2 repos

Phase 2 (parallel): ✅ DONE
  5.1 + 5.5 comparisons × 5 agents
  5.2 Incremental PR × DRF
  5.4 Intent selection × 3 repos

Phase 3: ✅ DONE
  5.3 Zero-prompt pilot × DRF
```

## Actual Cost

| Experiment | Agent sessions | Wall-clock time |
|---|---|---|
| Reference graphs | 3 | ~20 min |
| 5.1 construction | 3 | ~8 min |
| 5.1 comparison | 3 | ~4 min |
| 5.2 PR analysis | 1 | ~4 min |
| 5.4 selection | 1 | ~5 min |
| 5.5 construction | 2 | ~8 min |
| 5.5 comparison | 2 | ~5 min |
| 5.3 pilot | 1 | ~5 min (est) |
| **Total** | **16** | **~60 min** |

Massively under initial cost estimate (323 sessions / 140-185 hours) because:
- Streamlined methodology (combined phases)
- Single runs instead of 3 per condition
- Pilot for 5.3 instead of full experiment

## Files

```
experiments/5-invisibility/
├── STATUS.md (this file)
├── METHODOLOGY.md
├── synthesis.md ← FINAL RESULTS
├── exp-5.1-auto-construct/
│   ├── methodology.md
│   ├── results.md
│   ├── drf-reference/        (reference graph + questions + gold answers)
│   ├── caddy-reference/       (reference graph + questions + gold answers)
│   ├── payload-reference/     (reference graph + questions + gold answers)
│   ├── drf-auto/              (auto-constructed graph + git notes)
│   ├── caddy-auto/            (auto-constructed graph + git notes)
│   ├── payload-auto/          (auto-constructed graph + git notes)
│   ├── drf-comparison/        (structural + semantic + errors)
│   ├── caddy-comparison/
│   └── payload-comparison/
├── exp-5.2-incremental-pr/
│   ├── methodology.md
│   └── drf-results/           (10 commit patches + comparison + summary)
├── exp-5.3-zero-prompt/
│   ├── methodology.md
│   └── drf-pilot/             (5 tasks × 3 conditions, pilot results)
├── exp-5.4-intent-selection/
│   ├── methodology.md
│   ├── tasks/                 (30 tasks across 3 repos)
│   └── results/               (per-repo + cross-repo + summary)
└── exp-5.5-non-expert-quality/
    ├── methodology.md
    ├── results.md
    ├── drf-guided/            (guided graph + transcript + analysis)
    ├── payload-guided/        (guided graph + transcript + analysis)
    ├── drf-comparison/        (structural + semantic + question + protocol)
    └── payload-comparison/
```

## Decision Matrix

| Experiment | Verdict | Product Action |
|---|---|---|
| 5.1 | **ITERATE** | Build `yg auto-init` with quality gate; fix relation direction; combine with 5.5 |
| 5.2 | **INVEST** | Build CI integration (`yg suggest-updates`); add secondary-artifact rules |
| 5.3 | **INVEST** (pilot) | Build lazy context injection; validate with full experiment |
| 5.4 | **INVEST** | Build `yg build-context --task "desc"` with S1 keyword + S2 fallback |
| 5.5 | **INVEST** | Build `yg guided-init` with behavioral probes |

**Combined: 4 INVEST + 1 ITERATE → Full invisibility is viable. Build the integration layer.**
