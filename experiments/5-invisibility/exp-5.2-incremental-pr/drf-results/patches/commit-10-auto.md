# Auto Patch: Commit 10 — Remove long deprecated code from request wrapper

```yaml
pr: e13688f0
type: refactor
required_updates:
  - target: request-pipeline/request/interface.md
    operation: modify
    description: "Remove DATA and QUERY_PARAMS deprecated properties from documentation — they have been fully removed from the codebase."
    source: "Diff in request.py — removal of two @property methods"
  - target: request-pipeline/request/internals.md
    operation: modify
    description: "Remove references to deprecated DATA/QUERY_PARAMS properties."
    source: "Diff in request.py"
decisions_in_pr: []
```
