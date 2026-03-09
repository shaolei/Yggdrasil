# Upstreams Interface

## Core Types

### Upstream

```go
type Upstream struct {
    *Host
    Dial        string `json:"dial,omitempty"`
    MaxRequests int    `json:"max_requests,omitempty"`
}
```

Bridges configuration to backend state. Embeds `*Host` for atomic state access.

**Key methods:**
- `Available() bool` — true if `Healthy() && !Full()`
- `Healthy() bool` — checks active health status, passive fail count, and circuit breaker
- `Full() bool` — true if `MaxRequests > 0 && NumRequests() >= MaxRequests`
- `fillDialInfo(repl) (DialInfo, error)` — resolves placeholders and parses network address
- `String() string` — returns the Dial address
- `fillHost()` — gets or creates Host from global UsagePool (static upstreams)
- `fillDynamicHost()` — gets or creates Host from dynamicHosts map (dynamic upstreams)

### Host

```go
type Host struct {
    numRequests  int64
    fails        int64
    activePasses int64
    activeFails  int64
}
```

All fields accessed atomically. Must not be copied.

**Methods:**
- `NumRequests() int` — current active request count
- `Fails() int` — current failure count
- `countRequest(delta int) error` — adjust request count
- `countFail(delta int) error` — adjust failure count
- `countHealthPass(delta int) error` — adjust active health pass count
- `countHealthFail(delta int) error` — adjust active health fail count
- `resetHealth()` — zero out active health counters

### UpstreamPool

```go
type UpstreamPool []*Upstream
```

## Dynamic Upstream Sources

### SRVUpstreams

Module ID: `http.reverse_proxy.upstreams.srv`

```go
func (su SRVUpstreams) GetUpstreams(r *http.Request) ([]*Upstream, error)
```

Resolves backends via DNS SRV records. Supports `_service._proto.name` format or direct domain lookup. Results cached with configurable refresh interval. Grace period allows using stale results on lookup failure.

### AUpstreams

Module ID: `http.reverse_proxy.upstreams.a`

```go
func (au AUpstreams) GetUpstreams(r *http.Request) ([]*Upstream, error)
```

Resolves backends via DNS A/AAAA records. Configurable port (default 80), IP version filtering, custom DNS resolver.

### MultiUpstreams

Module ID: `http.reverse_proxy.upstreams.multi`

```go
func (mu MultiUpstreams) GetUpstreams(r *http.Request) ([]*Upstream, error)
```

Aggregates results from multiple upstream sources in order. Errors from individual sources are logged but don't prevent other sources from being queried. Useful for redundant cluster failovers with the `first` selection policy.

## Failure Modes

- `fillDialInfo` returns error if dial address contains invalid placeholders or represents more than one socket (port range)
- SRV/A lookups return error if DNS resolution fails and no cached results are available (or grace period not configured)
- DNS cache has hard limit of 100 entries; evicts random entry when full
