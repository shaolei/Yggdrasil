# Formatters Responsibility

CLI output formatting — mainly context package to Markdown.

**In scope:**

- formatContextMarkdown(pkg: ContextPackage): string — converts context package to readable Markdown

**Out of scope:**

- Building context package (cli/core)
- Console coloring (chalk in cli/commands)
