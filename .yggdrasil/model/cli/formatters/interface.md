# Formatters Interface

## markdown.ts

- `formatContextMarkdown(pkg: ContextPackage): string`
  - Produces Markdown with: header (nodeName, nodePath, generated timestamp), sections (Global, Knowledge, Hierarchy, OwnArtifacts, Dependencies, Aspects, Flows), each with ### layer labels and content. Footer: token count, layer types. Sections with empty layers are skipped.
