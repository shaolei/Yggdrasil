# Validator Interface

- `validate(graph: Graph, scope?: string): Promise<ValidationResult>`
  - scope: 'all' or node path. Returns issues (errors + warnings), nodesScanned. Structural errors block build-context.
