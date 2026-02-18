# Templates Rationale

**Reference:** docs/idea/foundation.md (Why not flat files), tools.md (Init, platform rules)

Yggdrasil does not compete with platform-specific instruction files (CLAUDE.md, .cursor/rules/, copilot-instructions). It **uses them**. The platform delivers the mechanism (where the agent reads instructions); Yggdrasil delivers the content (what the agent should do with the graph).

**Why installRulesForPlatform:** Each platform has a different location for agent rules. Cursor: .cursor/rules/. Claude: AGENTS.md. Copilot: .github/. Init writes the same behavioral content to the platform-specific path. One content, many delivery points. The rules teach the agent *when* to act (session open, before file edit, after decision) and *how* to use the graph (owner, build-context, validate).

**Why DEFAULT_CONFIG is empty name/stack:** Init creates structure; the agent (or human) fills identity. The tool does not guess project name or stack. Empty values signal "configure me." Validation may tolerate invalid config for read-only operations, but a complete graph needs a configured project.

**Why graph-templates are copied at init:** New projects need scaffolding. Node, module, service, library templates provide suggested_artifacts and guidance. The agent creating a node consults the template. One-time copy — after init, templates live in .yggdrasil/templates/ and are project-owned.
