# Conditions — What Each Agent Receives

## C0: No Graph (Baseline)

**System prompt**: "You are a software engineer working on Django REST Framework."

**Per task**: Only the task description. Agent can read any source file in `rest_framework/`.

**No graph artifacts, no architectural context, no Yggdrasil.**

---

## C1: Manual yg Protocol

**System prompt**: "You are a software engineer working on Django REST Framework." + full agent-rules.md + yg CLI access.

**Per task**: Task description. Agent follows yg protocol: `yg owner`, `yg build-context`, `yg impact` before making changes.

**Token overhead estimate**: ~500 tokens (agent-rules) + ~3000-6000 tokens per `build-context` call (typically 1-3 calls per task) = ~4000-18000 tokens of graph context per task.

---

## C3: Lazy Injection

**System prompt**: "You are a software engineer working on Django REST Framework."

**Per task**: Task description + "Background context" section containing pre-assembled graph artifacts for the nodes implied by the task. Agent does NOT know about Yggdrasil.

### Per-Task Context Assembly

#### T01 (Bug Fix — CSRF 403 vs 401)
**Implied files**: `authentication.py`, `views.py`
**Injected nodes**: authentication, api-view
**Injected content**:
- Authentication node: responsibility.md, interface.md, internals.md
- APIView node: responsibility.md, interface.md (handle_exception, permission_denied sections)
- Flow: api-request-processing/description.md (authentication failure + permission denied paths)
- Aspect: class-based-policy/requirements.md (rule 4: execution order)

**Estimated tokens**: ~4500

#### T02 (Feature — Per-method throttle scope)
**Implied files**: `throttling.py`, `views.py`
**Injected nodes**: throttling, api-view
**Injected content**:
- Throttling node: responsibility.md, interface.md, internals.md
- APIView node: interface.md (check_throttles, get_throttles sections)
- Aspect: class-based-policy/requirements.md (behavior in policy classes, not views)

**Estimated tokens**: ~3500

#### T03 (Refactor — Extract _authenticate)
**Implied files**: `request.py`, `authentication.py`
**Injected nodes**: request, authentication
**Injected content**:
- Request node: responsibility.md, interface.md, internals.md
- Authentication node: responsibility.md, interface.md
- Aspect: lazy-evaluation/requirements.md (wrap_attributeerrors, why _authenticate is on Request)

**Estimated tokens**: ~5000

#### T04 (Cross-Module — Authenticator names in errors)
**Implied files**: `views.py`, `request.py`, `exceptions.py`
**Injected nodes**: api-view, request, authentication
**Injected content**:
- APIView node: interface.md (permission_denied, handle_exception)
- Request node: interface.md (authenticators, successful_authenticator properties)
- Authentication node: interface.md
- Flow: permission denied path from description.md

**Estimated tokens**: ~4000

#### T05 (Constraint — Cache permissions)
**Implied files**: `views.py`, `permissions.py`
**Injected nodes**: permissions, api-view
**Injected content**:
- Permissions node: responsibility.md, interface.md, internals.md
- APIView node: interface.md (check_permissions)
- Aspect: class-based-policy/requirements.md (per-request instantiation)
- Aspect: operator-composition/requirements.md (OR's has_object_permission semantics)
- Flow: invariants section

**Estimated tokens**: ~5500
