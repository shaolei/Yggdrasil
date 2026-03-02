# Formatters Constraints

- **Output format is plain text with XML-like section tags:** The context text formatter wraps each layer in tags (`<global>`, `<hierarchy>`, `<own-artifacts>`, `<aspect>`, `<dependency>`, `<event>`, `<flow>`, `<context-package>`). Attributes on tags encode provenance metadata.
- **Formatter is a pure function:** `formatContextText` receives a `ContextPackage` and returns a string. It performs no I/O, no validation, and no graph modification.
- **Deterministic output:** Sections are emitted in the fixed order defined by `ContextSection[]` (Global, Hierarchy, OwnArtifacts, Aspects, Relational). Within sections, layers appear in their array order. Attribute values are escaped for XML safety.
