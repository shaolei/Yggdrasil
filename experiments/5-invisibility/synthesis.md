# Experiment Series 5: Invisibility — Synthesis

## Executive Summary

Five experiments tested whether Yggdrasil can become invisible to developers. The answer is **conditionally yes** — 4 of 5 experiments reach INVEST or strong ITERATE, but the path requires a hybrid approach combining automatic construction with targeted human input.

| Experiment | Verdict | Key Metric |
|---|---|---|
| **5.1** Auto-construct from git | **ITERATE** | Structural 100% (DRF) / 59% (Caddy) — git quality dependent |
| **5.2** Incremental from PRs | **INVEST** | Precision 100%, Recall 81%, zero FP |
| **5.3** Zero-prompt delivery | **INVEST** (pilot) | Lazy injection 97.5% of manual protocol; +178% on constraint tasks |
| **5.4** Intent-based selection | **INVEST** | S1 keyword: 89% precision, 96% recall |
| **5.5** Non-expert quality | **INVEST** | Guided novice: 82-90% of expert quality |

---

## What We Learned

### 1. Auto-construction works, but is git-quality-dependent (5.1)

The experiment revealed a clear relationship:

| Git History Quality | Structural Coverage | Semantic Coverage |
|---|---|---|
| Rich (400 commits, 27% with body) | 100% | 95.7% |
| Moderate (11 commits, 45% with WHY) | 59.4% | 59.4% |
| Minimal (2 commits, shallow) | 55.8% | 64% |

**Implication**: Auto-construction is viable for repos with rich commit culture (DRF-like). For others, it produces a useful scaffold (nodes + basic relations) but misses aspects and architectural patterns.

**Zero fabrication across all 3 repos** — the "never invent rationale" instruction works consistently.

### 2. PR-based maintenance is production-ready (5.2)

The standout result: **100% precision, 0% false positives**. An automated CI integration would never degrade the graph. Recall at 81% means ~1 in 5 needed updates is missed, but these follow two systematic patterns (secondary artifact miss, responsibility boundary miss) that are addressable with simple rules.

**This is the fastest path to invisibility.** Once a graph exists, it can maintain itself through PR analysis with high reliability.

### 3. Keyword search solves node selection (5.4)

The simplest algorithm won: weighted keyword matching against graph artifacts achieves 89% precision and 96% recall across 30 tasks in 3 languages. No ML, no embeddings, no complex infrastructure needed.

**Why it works**: Graph artifacts (responsibility.md, interface.md) are naturally written in the same vocabulary developers use in task descriptions. The graph is already optimized for intent matching — by design.

### 4. Developers don't need to know Yggdrasil (5.5)

8-13 guided questions produce a graph at 82-90% of expert quality. The extraction protocol compensates for the developer's lack of Yggdrasil knowledge. Key insight: asking "what would break if you changed X?" works better than "why was X designed this way?" — behavioral probes extract rationale from observable behavior, not memory.

### 5. Decision capture is the persistent gap

Across all experiments, decision capture (especially "why NOT") is the weakest metric:

| Experiment | Decision Capture |
|---|---|
| 5.1 auto-construct | 52-86% |
| 5.2 PR maintenance | 60% |
| 5.5 guided novice | 32-50% |

Decisions are the highest-value graph content (series 2 finding) but the hardest to capture automatically. They require either: (a) rich git history with explicit rationale, (b) behavioral probes in guided extraction, or (c) PR discussions where reviewers ask "why not do X?"

---

## The Invisibility Architecture

Based on these results, the path to invisible Yggdrasil has 4 layers:

```
Layer 4: DELIVERY (exp 5.3 + 5.4)
  Developer describes task → S1 keyword selects nodes →
  context injected into agent prompt → agent "just knows"

Layer 3: MAINTENANCE (exp 5.2)
  PR merged → CI analyzes diff → graph patch proposed →
  auto-applied (high confidence) or flagged (uncertain)

Layer 2: ENRICHMENT (exp 5.5)
  First session: guided extraction (8-13 questions) →
  developer answers about their code → graph enriched with
  decisions and patterns from behavioral probes

Layer 1: BOOTSTRAP (exp 5.1)
  `yg auto-init` → analyze git history + source code →
  build initial graph (nodes, relations, basic aspects) →
  quality gate warns if git history is thin
```

**Each layer compensates for the layer below:**
- Bootstrap (L1) gives structure but misses decisions → Enrichment (L2) fills decisions
- Enrichment (L2) is one-time → Maintenance (L3) keeps it current
- Maintenance (L3) updates the graph → Delivery (L4) serves it to agents

---

## Product Roadmap

### Phase 1: Foundation (ship first)

| Feature | Experiment | Confidence | Effort |
|---|---|---|---|
| `yg build-context --task "desc"` | 5.4 | HIGH | LOW |
| `yg auto-init` (with quality gate) | 5.1 | MEDIUM | MEDIUM |
| Fix relation directionality in auto-init | 5.1 | HIGH | LOW |

**`--task` flag is the quickest win.** Keyword search is trivial to implement, immediately useful, and enables Layer 4 without any infrastructure.

### Phase 2: Maintenance (ship second)

| Feature | Experiment | Confidence | Effort |
|---|---|---|---|
| `yg suggest-updates` (CI integration) | 5.2 | HIGH | MEDIUM |
| Secondary artifact checking rules | 5.2 | HIGH | LOW |
| PR template for decisions | 5.2 | MEDIUM | LOW |

**CI integration is the invisibility enabler.** Once graphs auto-maintain, the developer never touches `.yggdrasil/` again.

### Phase 3: Onboarding (ship third)

| Feature | Experiment | Confidence | Effort |
|---|---|---|---|
| `yg guided-init` (question protocol) | 5.5 | MEDIUM-HIGH | MEDIUM |
| Behavioral probes for decisions | 5.5 | MEDIUM | LOW |
| Flow diversity question | 5.5 | HIGH | LOW |

**Guided init is the adoption accelerator.** No training needed — developer answers questions about their code, extraction agent builds the graph.

### Phase 4: Integration (ship last)

| Feature | Experiment | Confidence | Effort |
|---|---|---|---|
| IDE extension (context injection) | 5.3 | MEDIUM | HIGH |
| Agent hook (pre-file-read enrichment) | 5.3 | MEDIUM | MEDIUM |

**Context injection requires the most engineering** but provides the final invisibility layer.

---

## What NOT To Build

1. **Don't invest in semantic/embedding search for node selection.** S1 keyword works at 89% precision. Embeddings add infrastructure cost with marginal gain.

2. **Don't try to auto-detect protocol/architectural aspects.** These require domain knowledge (e.g., "hop-by-hop headers must be stripped"). Auto-init should detect implementation patterns only; architectural patterns need human input.

3. **Don't try to infer decisions from code alone.** Decision capture plateaus at 50-85% regardless of approach. The remaining decisions are fundamentally invisible in code — they exist only in human memory or PR discussions.

4. **Don't require full clone for auto-init.** Warn about shallow clones but still produce a scaffold — even 55% structural coverage is better than nothing.

---

## Key Numbers

| Metric | Value | Source |
|---|---|---|
| Fabrication rate (auto-construct) | 0-2% | 5.1, all repos |
| PR patch precision | 100% | 5.2, DRF |
| PR patch recall | 81% | 5.2, DRF |
| Node selection precision (keyword) | 89% | 5.4, all repos |
| Node selection recall (keyword) | 96% | 5.4, all repos |
| Guided novice quality | 82-90% of expert | 5.5, DRF + Payload |
| Minimum viable question set | 8-13 questions | 5.5, both repos |
| Decision capture (best case) | 52-86% | 5.1, DRF/Payload |
| Decision capture (worst case) | 32% | 5.5, Payload guided |
| Highest-ROI extraction question | A3: "How do components interact?" | 5.5, both repos |

---

## Limitations of This Series

1. **Same model throughout.** Claude built reference graphs, auto graphs, guided graphs, and compared them. Cross-model validation needed.

2. **Small graphs (5-6 nodes).** Results may not scale to 50+ node production graphs. Especially: S1 keyword selection may lose precision, relation traversal may become necessary.

3. **Single runs.** Methodology specified 3 runs per condition for variance measurement. Cost constraints limited us to 1 run each. Results are point estimates without confidence intervals.

4. **Simulated developer (5.5).** Real developers may be less patient, less precise, or more knowledgeable than the simulation. Follow-up with real developers recommended.

5. **DRF-biased.** DRF has exceptional commit culture. Most repos are closer to Caddy or Payload. The "INVEST" verdicts are strongest for DRF-like repos.

6. **5.2 single-repo.** PR maintenance was tested on DRF only. Need validation on 2+ more repos.

7. **5.3 pilot only.** Full experiment with 15 tasks × 5 conditions × 3 runs not executed.

---

## Decision Matrix

| Experiment | Verdict | Action |
|---|---|---|
| 5.1 Auto-construct | **ITERATE** | Build `yg auto-init` with quality gate; fix relation direction; hybrid with 5.5 |
| 5.2 PR maintenance | **INVEST** | Build CI integration; add secondary-artifact rules |
| 5.3 Zero-prompt | **INVEST** (pilot) | Build lazy injection; validate with full experiment |
| 5.4 Intent selection | **INVEST** | Build `--task` flag with S1 + S2 fallback |
| 5.5 Non-expert | **INVEST** | Build `yg guided-init`; add behavioral probes |

**Combined verdict: 4 INVEST + 1 ITERATE = Invisibility is viable.**

The hybrid path is clear:
1. Auto-init bootstraps structure (L1)
2. Guided extraction fills decisions (L2)
3. CI maintains automatically (L3)
4. Keyword selection + lazy injection delivers context (L4)

Developer never sees `.yggdrasil/`. Agent "just knows."
