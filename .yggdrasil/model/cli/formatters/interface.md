# Formatters Interface

Public API consumed by cli/commands/validation (build-context).

## context-text.ts (primary)

- `formatContextText(pkg: ContextPackage): string`
  - Converts a context package to plain text with XML-like tags.
  - Input: `ContextPackage` from cli/model.
  - Output: plain text. Tags: `<context-package>`, `<global>`, `<hierarchy>`, `<own-artifacts>`, `<aspect name="..." id="..." source="node|flow:Name">`, `<dependency>`, `<flow>`. Content between tags is raw text (no CDATA, no escaping).
  - Pure transformation — no I/O, no validation.

## markdown.ts (legacy)

- `formatContextMarkdown(pkg: ContextPackage): string`
  - Converts a context package to Markdown. Used by tests.
  - Output: Markdown with `##` sections, `###` layer labels.
