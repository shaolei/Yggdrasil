# Validation Commands Responsibility

**In scope:** `yg validate` and `yg build-context`.

- **validate:** loadGraph(tolerateInvalidConfig), validate, output errors/warnings. Trims --scope; empty or whitespace treated as "all".
- **build-context:** loadGraph, validate (structural errors block), buildContext, formatContextMarkdown. Trims --node and strips trailing slash. Outputs to stdout. Exits 1 if validation errors or budget exceeded.

**Out of scope:** Drift, journal, graph navigation (other command groups).
