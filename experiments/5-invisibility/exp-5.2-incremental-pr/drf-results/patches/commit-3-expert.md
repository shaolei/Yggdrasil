# Expert Patch: Commit 3 — Fix infinite recursion with deepcopy on Request

```yaml
pr: d507cd85
type: bugfix
required_updates:
  - target: request-pipeline/request/internals.md
    operation: modify
    description: "Document the __getattr__ fix: uses self.__getattribute__('_request') instead of self._request to avoid infinite recursion when deepcopy is used. deepcopy creates an empty object without __dict__, so self._request triggers __getattr__ recursively. The fix bypasses __getattr__ by using __getattribute__ directly."
    source: "Diff in request.py lines 413-418"
  - target: request-pipeline/request/interface.md
    operation: modify
    description: "Add note under failure modes or edge cases: Request objects are safe to deepcopy after this fix."
    source: "Diff + commit title"
decisions_in_pr:
  - decision: "Chose __getattribute__ over checking __dict__ because __getattribute__ is the standard Python mechanism to bypass __getattr__ and is more robust."
    source: "Inferred from code — PR does not explain"
    should_be_captured: false
```
