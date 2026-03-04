# Validator Interface

- `validate(graph: Graph, scope?: string): Promise<ValidationResult>`
  - Parameters: `graph` (Graph), `scope` (string, default 'all') — 'all' or node path.
  - Returns: `ValidationResult` with `issues` (ValidationIssue[]), `nodesScanned` (number).
  - When scope is a node path: filters issues to that node; returns single error in issues if node not found (invalid-scope, nodesScanned: 0).
  - No throw for normal validation — all issues returned in result. Uses buildContext internally for W005/W006 (context budget).

## Failure Modes

- **validate**: No throws for normal validation — all issues returned as ValidationResult.issues (errors + warnings).
- **invalid-scope**: When scope is non-empty and node not found, returns single error in ValidationResult: `{ severity: 'error', rule: 'invalid-scope', message: "Node not found: ${scope}" }`, nodesScanned: 0.
- **buildContext failure**: If buildContext throws during W005/W006 check, error is caught and skipped (other rules will surface structural issues).
- **E018 invalid-aspect-exception**: When a node's `aspect_exceptions` references an aspect id that is not in the node's own `aspects` list, an error is emitted per invalid reference.
