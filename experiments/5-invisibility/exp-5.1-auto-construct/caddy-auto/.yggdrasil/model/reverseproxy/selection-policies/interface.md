# Selection Policies Interface

## Selector Interface

```go
type Selector interface {
    Select(pool UpstreamPool, req *http.Request, w http.ResponseWriter) *Upstream
}
```

All policies implement this interface. Returns nil if no upstream is available.

## Policies

| Policy | Module ID | Algorithm | Sticky |
|---|---|---|---|
| RandomSelection | `random` | Reservoir sampling | No |
| RandomChoiceSelection | `random_choose` | Pick N random, select least loaded | No |
| LeastConnSelection | `least_conn` | Least active requests (reservoir sample ties) | No |
| RoundRobinSelection | `round_robin` | Atomic counter mod pool size, skip unavailable | No |
| WeightedRoundRobinSelection | `weighted_round_robin` | Weighted round-robin with configurable weights | No |
| FirstSelection | `first` | First available in order | No |
| IPHashSelection | `ip_hash` | Rendezvous hash on RemoteAddr IP | Yes (by IP) |
| ClientIPHashSelection | `client_ip_hash` | Rendezvous hash on trusted client IP | Yes (by client IP) |
| URIHashSelection | `uri_hash` | Rendezvous hash on RequestURI | Yes (by URI) |
| QueryHashSelection | `query` | Rendezvous hash on query parameter value | Yes (by query) |
| HeaderHashSelection | `header` | Rendezvous hash on header value | Yes (by header) |
| CookieHashSelection | `cookie` | Cookie-based sticky sessions with HMAC | Yes (by cookie) |

## Hash-Based Policies

All hash-based selection uses Rendezvous (Highest Random Weight) hashing via xxhash. This guarantees minimal disruption when the upstream list changes -- only requests mapped to the added/removed upstream move.

## Cookie Policy Details

- Default cookie name: `lb`
- Cookie value: HMAC-SHA256 of upstream dial address with configurable secret
- Sets `Secure` and `SameSite=None` when request is HTTPS (or trusted proxy with X-Forwarded-Proto: https)
- On missing/invalid cookie: falls back to fallback policy and sets new cookie
- Supports configurable `max_age` for cookie expiry

## Fallback Policies

QueryHashSelection, HeaderHashSelection, and CookieHashSelection support a configurable fallback policy (default: random) used when the hash key is absent from the request.
