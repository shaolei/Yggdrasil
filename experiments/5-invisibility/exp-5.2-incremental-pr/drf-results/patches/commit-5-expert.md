# Expert Patch: Commit 5 — Replace partition with split in BasicAuthentication

```yaml
pr: 1355890f
type: refactor
required_updates:
  - target: request-pipeline/authentication/internals.md
    operation: modify
    description: "Update BasicAuthentication credential parsing: now uses str.split(':', 1) instead of str.partition(':'). This changes behavior: partition returns empty string for missing password, split raises ValueError. ValueError is now caught alongside existing exceptions. This means requests with no colon in credentials now fail with 'Credentials not correctly base64 encoded' instead of silently proceeding with an empty password."
    source: "Diff in authentication.py lines 78-89"
  - target: request-pipeline/authentication/interface.md
    operation: modify
    description: "Update BasicAuthentication failure modes: credentials without a colon separator now raise AuthenticationFailed instead of proceeding with empty password."
    source: "Diff + commit message mentioning 'test if basic auth without provided password fails'"
decisions_in_pr:
  - decision: "Chose split over partition because partition allowed credentials without a colon to silently pass with an empty password, which is a security concern."
    source: "Inferred from code change + test addition — PR does not explicitly state rationale"
    should_be_captured: true
```
