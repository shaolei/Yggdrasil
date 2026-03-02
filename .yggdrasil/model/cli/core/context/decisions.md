# Context Builder Decisions

**Five layers in that specific order:** The assembly proceeds from most general (global config: project name, stack, standards) to most specific (relational context for direct dependencies). Each layer adds precision without repeating the previous. Global sets the project frame, hierarchy provides domain context, own artifacts define the node itself, relational context describes integration points, and aspects add cross-cutting requirements.

**structural_context flag gates relational inclusion:** Without this flag, every dependency would include all its artifacts in the consuming node's context, causing excessive token usage. The flag allows config.yaml to declare which artifacts (e.g., interface.md, errors.md) carry the integration-relevant information. Only those are included for structural relations. If no structural artifacts exist on the target, all configured artifacts are included as fallback.
