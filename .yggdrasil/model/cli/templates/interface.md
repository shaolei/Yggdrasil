# Templates Interface

## default-config.ts

- `DEFAULT_CONFIG: string` — YAML string for config.yaml (name: "", stack, standards, tags, node_types, artifacts, knowledge_categories, quality). Agent fills name/stack/standards after init.

## platform.ts

- `installRulesForPlatform(projectRoot: string, platform: Platform): Promise<string>` — writes rules to platform-specific path, returns that path.

**Supported platforms (canonical list):** cursor, claude-code, copilot, cline, roocode, codex, windsurf, aider, gemini, amp, generic.

| Platform   | Output path / mechanism |
|------------|--------------------------|
| cursor     | .cursor/rules/yggdrasil.mdc (folder-drop) |
| cline      | .clinerules/yggdrasil.md (folder-drop) |
| roocode    | .roo/rules/yggdrasil.md (folder-drop) |
| windsurf   | .windsurf/rules/yggdrasil.md (folder-drop) |
| claude-code| .yggdrasil/agent-rules.md + CLAUDE.md with @ import |
| gemini     | .yggdrasil/agent-rules.md + GEMINI.md with @ import |
| amp        | .yggdrasil/agent-rules.md + AGENTS.md with @ import |
| copilot    | .github/copilot-instructions.md (section between markers) |
| codex      | AGENTS.md (section between markers) |
| aider      | .yggdrasil/agent-rules.md + .aider.conf.yml read: entry |
| generic    | .yggdrasil/agent-rules.md only |

## rules.ts

- Exports rules content for agents (when to act, session protocol, graph conventions).
