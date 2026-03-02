# Validator Decisions

**Stable error codes E001-E017, W001-W011:** Each validation rule has a fixed code (E for errors, W for warnings). These codes are machine-readable identifiers stable across versions, enabling CI pipelines and automation to match on specific codes rather than fragile message text. New rules receive the next available code.

**Warnings do not block build-context:** Warnings (W-codes) indicate quality suggestions such as shallow artifacts, high fan-out, or missing optional coverage. Errors (E-codes) indicate structural integrity failures such as broken relations, missing node.yaml, or cycles. Only errors represent states where the graph is structurally invalid. build-context operates on the loaded graph and does not consult validation results, so warnings never prevent context assembly.
