# Auto Patch: Commit 6 — Fix error in throttling when request.user is None

```yaml
pr: 129890ab
type: bugfix
required_updates:
  - target: request-pipeline/throttling/internals.md
    operation: modify
    description: "Add null-check for request.user before accessing is_authenticated in AnonRateThrottle, UserRateThrottle, and ScopedRateThrottle get_cache_key methods."
    source: "Diff in throttling.py — three parallel changes"
  - target: request-pipeline/throttling/interface.md
    operation: modify
    description: "Update get_cache_key contract: handles request.user being None gracefully."
    source: "Diff in throttling.py"
decisions_in_pr: []
```
