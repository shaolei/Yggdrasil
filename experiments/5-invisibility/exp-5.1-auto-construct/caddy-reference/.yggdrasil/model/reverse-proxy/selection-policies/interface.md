# Selection Policies Interface

## Selector Interface

```go
type Selector interface {
    Select(pool UpstreamPool, req *http.Request, w http.ResponseWriter) *Upstream
}
```

Returns nil if no upstream is available.

## Policies

### RandomSelection
Module ID: `http.reverse_proxy.selection_policies.random`
Selects a random available host using reservoir sampling.

### RandomChoiceSelection
Module ID: `http.reverse_proxy.selection_policies.random_choose`
Picks `Choose` (default 2) random hosts, then selects the one with least active requests. Also known as "power of two choices."
- Config: `choose int` (must be >= 2)

### LeastConnSelection
Module ID: `http.reverse_proxy.selection_policies.least_conn`
Selects the host with fewest active requests. Ties broken by reservoir sampling.

### RoundRobinSelection
Module ID: `http.reverse_proxy.selection_policies.round_robin`
Cycles through hosts in order using atomic counter. Skips unavailable hosts.

### WeightedRoundRobinSelection
Module ID: `http.reverse_proxy.selection_policies.weighted_round_robin`
Round-robin with per-upstream weights. Upstreams with weight 0 are skipped.
- Config: `weights []int` (one per upstream, non-negative)

### FirstSelection
Module ID: `http.reverse_proxy.selection_policies.first`
Selects the first available host in pool order. Useful with MultiUpstreams for prioritized failover.

### IPHashSelection
Module ID: `http.reverse_proxy.selection_policies.ip_hash`
Hashes `req.RemoteAddr` (remote IP) to select a consistent upstream.

### ClientIPHashSelection
Module ID: `http.reverse_proxy.selection_policies.client_ip_hash`
Like IPHashSelection but uses the client IP as determined by Caddy's trusted proxy settings (respects X-Forwarded-For).

### URIHashSelection
Module ID: `http.reverse_proxy.selection_policies.uri_hash`
Hashes `req.RequestURI` to select a consistent upstream.

### QueryHashSelection
Module ID: `http.reverse_proxy.selection_policies.query`
Hashes a specific query parameter value. Falls back to configurable policy (default: random) if key is absent.
- Config: `key string` (required), `fallback Selector` (default: random)

### HeaderHashSelection
Module ID: `http.reverse_proxy.selection_policies.header`
Hashes a specific request header value. Special handling for Host header (reads from `req.Host`). Falls back to configurable policy (default: random) if header is absent.
- Config: `field string` (required), `fallback Selector` (default: random)

### CookieHashSelection
Module ID: `http.reverse_proxy.selection_policies.cookie`
Sticky sessions via cookie. On first request (or when cookie's upstream is unavailable), selects via fallback policy and sets a cookie with HMAC-SHA256 hash of the upstream address. Subsequent requests with matching cookie go to the same upstream.
- Config: `name string` (default: "lb"), `secret string`, `max_age duration`, `fallback Selector` (default: random)
- Cookie is Secure with SameSite=None when request is HTTPS or behind trusted HTTPS proxy

## Failure Modes

- All policies return nil if pool is empty or all upstreams are unavailable
- Hash-based policies with fallback return fallback result when hash key is missing
- Cookie policy falls back when stored upstream is no longer available
