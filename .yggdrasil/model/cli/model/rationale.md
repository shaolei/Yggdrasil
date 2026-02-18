# Model Rationale

**Reference:** docs/idea/graph.md (Node structure, relations), engine.md (Context package format)

Model defines the **shared vocabulary** — the TypeScript types that describe the graph and its operations. Graph, GraphNode, Relation, ContextPackage, ValidationResult, DriftReport — these are the structures that flow between io, core, commands, and formatters.

**Why types only, no runtime logic:** Model is the schema. It has no side effects, no I/O, no business logic. It exists for compile-time safety and as documentation. When io parses a file, it produces NodeMeta. When core builds context, it produces ContextPackage. The types are the contract.

**Why RelationType is an enum:** uses, calls, extends, implements, emits, listens — these six are the only valid relation kinds. Structural relations (first four) require acyclicity; event relations (emits, listens) may cycle. The type system enforces this. Validators check it. No stringly-typed relations.

**Why separate from io:** IO knows about file format (YAML structure, field names). Model knows about domain concepts (Graph, Node, Relation). IO converts bytes to Model. Core operates on Model. Clean layering.
