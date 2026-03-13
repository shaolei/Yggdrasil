## Logic

# Templates Logic

## installRulesForPlatform

- Switch on platform: cursor → installForCursor; claude-code → installForClaudeCode; etc.; default → installForGeneric
- Each installForX: ensure target dir exists; write rules file (AGENT_RULES_CONTENT) with platform-specific wrapper (frontmatter, section markers, etc.)

## ensureAgentRules

- mkdir .yggdrasil; writeFile agent-rules.md with AGENT_RULES_CONTENT

## Platform-specific paths

- cursor: .cursor/rules/yggdrasil.mdc

- claude-code, aider, gemini, amp: ensureAgentRules; then platform-specific file (CLAUDE.md, etc.) imports or embeds agent-rules

- generic: .yggdrasil/agent-rules.md

## Init copy

- graph-schemas/*.yaml → .yggdrasil/schemas/ (during init, not in this node's logic)

## Decisions

# Templates Decisions

**Hand-tuned content:** Agent rules content is explicitly maintained by humans. The rules.ts comment states: "Canonical agent rules content — hand-tuned, do not generate programmatically." This ensures the operating manual reflects deliberate design decisions.

**Intent capture mandate:** The rules enforce "CAPTURE INTENT, BUT NEVER INVENT IT" — agents must permanently record the user's "why" (business reason, rationale) in graph artifacts when provided, but never infer or hallucinate it. This makes the graph the semantic meaning layer (Intent -> Graph -> Outputs) and protects against chat context evaporation.

**Enrichment priority guidance:** Rules now include explicit guidance on artifact enrichment order: interface.md first (highest cross-module ROI), then responsibility.md, then internals.md. This is based on experiment findings about cross-module value.

**Aspect stability tiers:** Rules include guidance on the `stability` field in yg-aspect.yaml (schema/protocol/implementation) with calibrated review urgency for each tier, and guidance on using code anchors (declared per-node in `yg-node.yaml` `anchors` field, validated by `yg validate` W014/E019) for staleness detection during drift resolution.

**Action recognition rule:** Rules include an explicit "Recognizing Graph-Required Actions" section that tells agents: what matters is the ACTION (understanding mapped code), not the SOURCE of the instruction (skill, plan, user, workflow). This prevents external workflows from overriding the graph protocol — agents must run `yg owner` + `yg build-context` before any action that involves understanding mapped code, regardless of what instructed it. The Failure States section reinforces this with source-agnostic language.

**Platform-specific installation:** Each agent platform has its own conventions for rules location. The platform.ts module centralizes this mapping so `yg init --platform <name>` works consistently across IDEs.

**Default config as template:** DEFAULT_CONFIG provides a minimal valid yg-config.yaml that adopters can customize. It mirrors yg-config.yaml schema but is a string constant for embedding. Defines 4 node types as an object keyed by type name (module, service, library, infrastructure), each with a description string explaining its purpose. Defines 3 artifacts (responsibility.md, interface.md, internals.md). Chose 3 artifacts over the previous 8 because responsibility + interface + internals capture the three essential layers (WHAT, HOW TO USE, HOW IT WORKS + WHY) without forcing adopters to maintain rarely-used artifact types. The `infrastructure` node type was added for guards, middleware, interceptors, and other components that affect blast radius but are invisible in call graphs. Node type descriptions come from config (not hardcoded in rules) so adopters can customize them.

**Semantic search navigation (step 0):** Added a pre-step to Quick Start Protocol teaching agents to use semantic search tools (when available) for top-down navigation — going from a high-level intent to the right graph nodes. Chose to embed this as step 0 in the existing protocol over creating a new `yg locate` CLI command because IDEs and agent environments already provide semantic search tools, and Yggdrasil's graph files (responsibility.md, flow descriptions, aspect content) are semantically rich plain files that these tools index automatically. Also chose conditional phrasing ("if a semantic search tool is available") over unconditional because not all agent environments have semantic search. Added corresponding evasion pattern row to prevent agents from defaulting to grep when semantic search is available.

**Subagent delegation rule:** CORE_PROTOCOL includes a "Delegating to Subagents" section requiring agents to prepend `.yggdrasil/agent-rules.md` as the first instruction when spawning subagents, plus explicit deliverables (working code + graph nodes + validate passing). Chose explicit instruction injection + acceptance criteria over relying on subagent auto-discovery because subagents do not inherit parent context and would otherwise read code without graph coverage, breaking graph-code consistency. Reading rules alone proved insufficient — subagents still deferred graph work without explicit deliverables. Alternative considered: embedding full rules in each subagent prompt — rejected because rules are long and the agent-rules.md file is already materialized on disk. The parent agent also gets a verification step: check for new/modified source files without graph coverage before accepting subagent output.

**Graph as specification (Rule 2 reframe):** Rule 2 was rewritten from "Code and graph are one" (a synchronization procedure) to "The graph is the specification; code implements it" (a philosophical principle). Chose the specification framing over the synchronization framing because agents treated the graph as documentation (written after code) rather than specification (written alongside or before code). The new rule establishes the graph as a "black hole" for knowledge — absorbing information from every source (external docs, conversations, decisions) and being self-sufficient. Timing tightened from "same response" to "before moving to the next file" to prevent batching. Planning rule added: graph updates are part of each step's definition of done, never a separate phase — this is tool-agnostic and applies to any planning workflow.
