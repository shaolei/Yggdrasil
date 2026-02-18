# Context Builder Responsibility

Assembles context packages for nodes — the 10-step layer assembly used by build-context.

**In scope:**

- 10-step assembly: (1) global config, (2–5) knowledge (global, tag, node, declared), (6) hierarchy ancestors, (7) own (node.yaml + configured artifacts), (8) relational (structural_context or fallback), (9) aspects by tag, (10) flows + flow knowledge.
- Deduplication of knowledge. Token estimation (~4 chars/token).

**Out of scope:**

- Graph loading (cli/core/loader)
- Validation (cli/core/validator)
