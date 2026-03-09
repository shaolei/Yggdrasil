# Structural Comparison: Caddy Reverse Proxy

## Nodes

Reference nodes (6): `reverse-proxy` (parent), `handler`, `health-checks`, `selection-policies`, `transport`, `upstreams`

Auto nodes (7): `reverseproxy` (implicit parent), `handler`, `healthchecks`, `selection-policies`, `http-transport`, `streaming`, `upstreams`

| Reference Node | Auto Match | Notes |
|---|---|---|
| reverse-proxy (parent) | reverseproxy (implicit) | Match — naming differs (`reverse-proxy` vs `reverseproxy`), no parent `yg-node.yaml` in auto |
| handler | handler | Match |
| health-checks | healthchecks | Match |
| selection-policies | selection-policies | Match |
| transport | http-transport | Match — renamed but same component |
| upstreams | upstreams | Match |
| — | streaming (extra) | Auto-only: split streaming out of handler |

**Node coverage**: 6/6 reference nodes matched = **100%**

**Extra nodes**: 1 (`streaming`) — auto split streaming.go into its own node instead of keeping it in handler.

**Node type mismatches**:
- `transport`: reference=`module`, auto=`service`
- `selection-policies`: reference=`module`, auto=`library`

## Relations

Reference relations (12 total across all nodes):

| Relation | Present in Auto? | Notes |
|---|---|---|
| handler -> selection-policies [Select] | Yes | Match |
| handler -> transport [RoundTrip] | Yes (-> http-transport) | Match |
| handler -> health-checks [countFailure, activeHealthChecker] | Yes | Match |
| handler -> upstreams [GetUpstreams, fillDialInfo, Available] | Partial | Auto has [GetUpstreams] only; fillDialInfo/Available missing |
| handler -> streaming (implicit in ref) | Yes (explicit in auto) | Auto made it explicit |
| health-checks -> upstreams [Host, setHealthy, countFail...] | No | Auto has healthchecks -> handler instead |
| health-checks -> transport [RoundTrip] | No | Auto has healthchecks -> handler |
| selection-policies -> upstreams [Available, NumRequests, Dial] | No | Auto has selection-policies -> handler |
| transport -> upstreams [DialInfo] | No | Auto has http-transport -> handler |
| upstreams -> health-checks [PassiveHealthChecks] | No | Not in auto |

Auto reversed several relations: reference has leaf nodes depending on `upstreams`, while auto has leaf nodes depending on `handler`. This is a systematic directionality difference.

**Relation coverage**: 4/12 reference relations fully present, 1 partial = **37.5%** (counting partial as 0.5 = **4.5/12 = 37.5%**)

## Aspects

Reference aspects (3): `caddy-module-pattern`, `hop-by-hop-header-stripping`, `upstream-availability`

Auto aspects (3): `caddy-module-pattern`, `dns-cache-with-locking`, `retry-with-health-tracking`

| Reference Aspect | Auto Match | Notes |
|---|---|---|
| caddy-module-pattern | caddy-module-pattern | Exact match |
| hop-by-hop-header-stripping | — | Missing |
| upstream-availability | retry-with-health-tracking | Partial semantic overlap — both cover health tracking affecting selection, but upstream-availability focuses on Available() as single source of truth; auto focuses on retry loop |

**Aspect coverage**: 1 exact + 0.5 partial = **1.5/3 = 50%**

**Extra aspects**: `dns-cache-with-locking` (auto-only, valid pattern but reference captured it in upstreams/internals.md instead of as an aspect)

## Flows

Reference flows (2): `request-proxying`, `health-monitoring`

Auto flows (1): `request-proxying`

| Reference Flow | Auto Match | Notes |
|---|---|---|
| request-proxying | request-proxying | Match (auto adds streaming as participant) |
| health-monitoring | — | Missing |

**Flow coverage**: **1/2 = 50%**

## Structural Coverage

| Dimension | Coverage |
|---|---|
| Nodes | 100% |
| Relations | 37.5% |
| Aspects | 50% |
| Flows | 50% |
| **Mean** | **59.4%** |
