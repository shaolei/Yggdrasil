# Formatters Decisions

**Pure transformation:** Formatters perform no I/O and no validation. They receive structured data and produce text. This keeps the layer deterministic and testable — callers own input validity.

**Context output format:** Plain text with XML-like tags (`<context-package>`, `<global>`, `<aspect>`, etc.) is designed for agent consumption. Tags provide structure and provenance (e.g. `source="flow:Checkout"` for flow-propagated aspects). Content between tags is raw text. Token count in root attributes supports context budget awareness.
