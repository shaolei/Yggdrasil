# Dynamic Upstreams Interface

## UpstreamSource Interface

```go
type UpstreamSource interface {
    GetUpstreams(r *http.Request) ([]*Upstream, error)
}
```

All dynamic upstream modules implement this interface.

## SRVUpstreams

### Configuration (JSON)

| Field | Type | Default | Description |
|---|---|---|---|
| `service` | string | - | SRV service label |
| `proto` | string | - | SRV protocol label (tcp/udp) |
| `name` | string | - | SRV name label (or full domain if service+proto empty) |
| `refresh` | duration | 1m | Cache refresh interval |
| `grace_period` | duration | 0 | Use stale results on failure |
| `resolver` | UpstreamResolver | nil | Custom DNS resolver |
| `dial_timeout` | duration | 0 | DNS resolver dial timeout |
| `dial_fallback_delay` | duration | 0 | RFC 6555 Fast Fallback delay |
| `dial_network` | string | "" | Network restriction (e.g., "tcp4") |

### `GetUpstreams(r *http.Request) ([]*Upstream, error)`

Performs SRV lookup (with caching). Supports placeholders in service/proto/name. Returns upstreams sorted by SRV priority/weight.

## AUpstreams

### Configuration (JSON)

| Field | Type | Default | Description |
|---|---|---|---|
| `name` | string | - | Domain name to look up |
| `port` | string | 80 | Port to use with discovered IPs |
| `refresh` | duration | 1m | Cache refresh interval |
| `versions` | IPVersions | both | IPv4/IPv6 filtering |
| `resolver` | UpstreamResolver | nil | Custom DNS resolver |

### `GetUpstreams(r *http.Request) ([]*Upstream, error)`

Performs A/AAAA lookup (with caching). IP version is part of the cache key to support different version configs for the same domain.

## MultiUpstreams

### Configuration (JSON)

| Field | Type | Description |
|---|---|---|
| `sources` | []module | Ordered list of upstream source modules |

### `GetUpstreams(r *http.Request) ([]*Upstream, error)`

Queries all sources in order, appending results. Errors from individual sources are logged and skipped. Checks for context cancellation between sources.

## UpstreamResolver

| Field | Type | Description |
|---|---|---|
| `addresses` | []string | DNS resolver addresses (network addresses, port range of 1) |

## Failure Modes

- DNS lookup failure with grace period: returns stale cached results.
- DNS lookup failure without grace period: returns error to caller.
- Individual source error in MultiUpstreams: logged, other sources still queried.
- Cache full (100 entries): random eviction before adding new entry.
