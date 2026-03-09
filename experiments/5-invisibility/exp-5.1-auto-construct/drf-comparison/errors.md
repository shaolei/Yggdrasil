# Error Analysis: DRF Auto-Constructed Graph

## Missing Elements (reference present, auto absent)

### Missing Decisions

| # | Decision | Severity | Notes |
|---|---|---|---|
| 1 | Session auth reads from `_request.user` to avoid recursion | Medium | Not captured as explicit decision in auto internals |
| 2 | Only first authenticator's header used for WWW-Authenticate | Medium | Not mentioned in auto graph at all |
| 3 | `check_object_permissions` not called automatically (design rationale) | Medium | Auto mentions the behavior in interface but doesn't capture the WHY |
| 4 | Fill empty data before re-raising parse errors | Medium | Auto mentions parse error handling but not this specific defense |
| 5 | ForcedAuthentication replaces authenticators (design decision) | Low | Auto mentions it in interface but not as an explicit decision |
| 6 | Separate `SAFE_METHODS` constant rationale | Low | Auto mentions the constant but not why it exists as a separate symbol |
| 7 | Timestamps list over counter rationale | Low | Auto captures sliding window but not this specific tradeoff |
| 8 | `AnonRateThrottle` skips authenticated users (design rationale) | Low | Mentioned in interface but not as decision with rationale |
| 9 | CSRF failure as PermissionDenied not AuthenticationFailed | Medium | Auto mentions the behavior but doesn't discuss the design choice |

### Missing Aspect Detail

| # | Element | Severity | Notes |
|---|---|---|---|
| 1 | `lazy-evaluation` aspect: `data` property laziness | Medium | Auto's `lazy-authentication` only covers auth laziness, reference covers data/parsing too |
| 2 | `lazy-evaluation`: `_hasattr`/sentinel pattern detail | Low | Auto mentions `Empty` sentinel in request internals but not in the aspect |

## Misattributed Elements (correct info, wrong location)

| # | Element | Reference Location | Auto Location | Severity |
|---|---|---|---|---|
| 1 | CSRF enforcement details | Captured in authentication internals | Extracted as separate `csrf-session-enforcement` aspect | Low -- arguably better placement since it spans views + authentication |
| 2 | Sliding window algorithm details | Captured in throttling internals | Also extracted as `sliding-window-throttle` aspect | Low -- same situation; arguably valid as a cross-cutting pattern |

## Over-split / Under-split

None identified. Auto graph has identical node granularity to reference.

## Fabricated / Phantom Rationale

None identified. All auto-graph rationale is either:
- Directly sourced from commit messages (with commit hashes)
- Sourced from code comments (quoted)
- Explicitly marked as "rationale: unknown -- inferred from code"

## Bonus Elements (auto has, reference doesn't)

| # | Element | Type | Assessment |
|---|---|---|---|
| 1 | `csrf-session-enforcement` aspect | Aspect | Valid cross-cutting concern spanning views and authentication. Reference captures this in authentication internals and APIView internals instead. |
| 2 | `sliding-window-throttle` aspect | Aspect | Valid pattern description. Reference captures this only in throttling internals. |
| 3 | OAuth removal as boundary note | Decision | Valid historical context from commit `baa518cd`. Reference doesn't mention OAuth history. |
| 4 | Multiple additional commit-sourced decisions | Decisions | e.g., Vary header patching, initial() reorder, set_rollback, all-throttles-checked. All verifiable. |
| 5 | Per-view exception handler customization | Decision | From commits `ebe174c0`, `c2ee1b30`. Not in reference. |
| 6 | Rejection of anonymous before queryset access | Decision | From commit `c8773671`. Not in reference. |

## Error Summary by Category

| Category | Count | Severity Distribution |
|---|---|---|
| Missing (decisions) | 9 | 4 Medium, 5 Low |
| Missing (aspect detail) | 2 | 1 Medium, 1 Low |
| Misattributed | 2 | 2 Low |
| Over-split / Under-split | 0 | -- |
| Fabricated | 0 | -- |
| Phantom rationale | 0 | -- |
| **Total errors** | **13** | **0 Critical, 5 Medium, 8 Low** |
| **Bonus elements** | **6** | All valid |
