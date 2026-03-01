# Formatters Responsibility

CLI output formatting — converts structured data to human-readable text.

**In scope:**

- `formatContextText(pkg: ContextPackage): string` — converts assembled context package to plain text with XML-like tags for `yg build-context` output (primary)
- `formatContextMarkdown(pkg: ContextPackage): string` — legacy Markdown format (used by tests)
- Output structure (context-text): `<context-package>`, `<global>`, `<hierarchy>`, `<own-artifacts>`, `<aspect>`, `<dependency>`, `<flow>`, `</context-package>`; content between tags is raw text
- Skips sections where `section.layers.length === 0`
- Footer: token count with `toLocaleString()`, layer types joined by comma
- Pure transformation — no I/O, no validation, deterministic (tag: deterministic)

**Out of scope:**

- Building context package (cli/core/context)
- Console coloring (cli/commands)
- Validation of input (callers must ensure valid ContextPackage)
