# Expert Patch: Commit 6 — Fix error in throttling when request.user is None

```yaml
pr: 129890ab
type: bugfix
required_updates:
  - target: request-pipeline/throttling/internals.md
    operation: modify
    description: "Document null-check guard: AnonRateThrottle, UserRateThrottle, and ScopedRateThrottle now check `request.user` is not None before accessing `is_authenticated`. This handles the case where authentication has not run or returned None for the user."
    source: "Diff in throttling.py — three identical changes at lines 174, 194, 242"
  - target: request-pipeline/throttling/interface.md
    operation: modify
    description: "Update get_cache_key contract for all three throttle classes: now handles request.user being None (treats as anonymous)."
    source: "Diff in throttling.py"
decisions_in_pr: []
```
