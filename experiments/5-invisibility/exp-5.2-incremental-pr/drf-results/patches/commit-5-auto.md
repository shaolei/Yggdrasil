# Auto Patch: Commit 5 — Replace partition with split in BasicAuthentication

```yaml
pr: 1355890f
type: refactor
required_updates:
  - target: request-pipeline/authentication/internals.md
    operation: modify
    description: "Update BasicAuthentication parsing: uses split(':', 1) instead of partition(':'). ValueError added to exception handler. Credentials without colon now fail instead of proceeding with empty password."
    source: "Diff in authentication.py lines 78-89"
decisions_in_pr: []
no_update_needed: []
```
