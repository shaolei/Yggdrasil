# Formatters Rationale

**Reference:** docs/idea/engine.md (Context package format)

The context package is a **Markdown document**. Agents read Markdown fluently. The format is constant (same section structure: Global, Knowledge, Hierarchy, OwnArtifacts, Dependencies, Aspects, Flows); the content is variable (depends on graph state and target node).

**Why Markdown, not JSON:** Agents are text models. Markdown is natural. Structured data (JSON) would require the agent to parse before understanding. Markdown flows. Headers, lists, code blocks — the agent consumes it directly. The format is defined in docs/idea/engine.md; formatters implement it.

**Why no interpretation of content:** Formatters take ContextPackage (already assembled by core) and serialize it. They do not parse artifact text, extract meaning, or transform logic. Copy layers to output. Add section headers. That's it. The agent interprets the content; the formatter just delivers it.

**Why token count in footer:** Budget awareness. The package reports its size. Commands use it for warning/error thresholds. The agent sees "Context size: 3,418 tokens" and knows the scale. Heuristic (~4 chars/token) is sufficient for monitoring, not for per-model precision.
