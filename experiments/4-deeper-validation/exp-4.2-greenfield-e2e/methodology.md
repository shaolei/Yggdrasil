# Experiment 4.2: Graph-First Greenfield End-to-End

## Thesis

The graph-first greenfield workflow (aspects → flows → nodes → build-context → implement) produces correct, complete implementations from context packages alone, without access to existing code.

## Design

### Module to Build

A **Rate Limiter Service** for a NestJS backend (matches Hoppscotch's stack). This is:
- Small enough to test (3-4 nodes)
- Complex enough to need aspects and flows
- Has clear correctness criteria

### Specification (input to graph-builder agent)

**Business requirement:** API rate limiting per user with configurable limits per endpoint group, sliding window algorithm, Redis-backed counters, and graceful degradation when Redis is unavailable.

**Node structure:**
1. `rate-limiter/` (module) — Domain parent
2. `rate-limiter/rate-limit-guard/` (infrastructure) — NestJS guard that intercepts requests
3. `rate-limiter/rate-limit-service/` (service) — Core logic: check/increment/reset
4. `rate-limiter/rate-limit-config/` (library) — Configuration loading and endpoint group mapping

**Aspects:**
- `graceful-degradation` — When Redis is down, allow requests (fail-open) and log warning
- `sliding-window` — Use sliding window log algorithm, not fixed window

**Flow:**
- `request-rate-check` — Business process from request arrival through rate check to response or rejection

### Phases

**Phase 1: Graph Construction**
- Agent A builds the complete graph following the greenfield workflow
- Output: all node.yaml, artifacts, aspects, flow files
- Validate with `yg validate`

**Phase 2: Isolated Implementation**
- Agent B receives ONLY the `yg build-context` output for each node (NO access to any source code, NO access to graph files directly)
- Agent B implements each node in materialization order (leaf dependencies first)
- Output: TypeScript source files

**Phase 3: Evaluation**
- Score each implemented file against the specification on:
  1. **Correctness** (0-5): Does it implement the specified behavior?
  2. **Completeness** (0-5): Are all edge cases from the spec covered?
  3. **Aspect compliance** (0-5): Does it satisfy graceful-degradation and sliding-window?
  4. **Interface adherence** (0-5): Does it match the interface.md contracts?
  5. **Integration readiness** (0-5): Would this work with the other nodes without modification?

### Success Criteria

- Mean score ≥ 4.0 across all dimensions = context package is self-sufficient
- Mean score < 3.0 on any dimension = identifies specific gap in context assembly
