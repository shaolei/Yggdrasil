# Expert Patch: Commit 10 — Remove long deprecated code from request wrapper

```yaml
pr: e13688f0
type: refactor
required_updates:
  - target: request-pipeline/request/interface.md
    operation: modify
    description: "Remove DATA and QUERY_PARAMS properties from interface documentation. These deprecated aliases (raising NotImplementedError since 3.2) have been fully removed."
    source: "Diff in request.py — removal of DATA and QUERY_PARAMS properties"
  - target: request-pipeline/request/internals.md
    operation: modify
    description: "Remove any mention of the deprecated DATA/QUERY_PARAMS properties and their deprecation history."
    source: "Diff in request.py"
decisions_in_pr: []
no_update_needed: []
```
