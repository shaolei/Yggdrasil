# Upstreams

Manages the pool of backend servers that can receive proxied requests. This includes both static upstreams (configured directly) and dynamic upstream sources that resolve backends at request time via DNS.

## Responsible for

- Defining the `Upstream` struct and `UpstreamPool` type that represent backend targets
- Managing upstream host state (`Host` struct) with atomic counters for requests, failures, and health check passes/fails
- Providing dynamic upstream resolution via SRV records (`SRVUpstreams`), A/AAAA records (`AUpstreams`), and multi-source aggregation (`MultiUpstreams`)
- Caching DNS lookup results with configurable refresh intervals and grace periods
- Determining upstream availability via `Available()`, `Healthy()`, and `Full()` methods
- Persisting host state across config reloads (static: global UsagePool; dynamic: time-evicted map)
- Providing `fillDialInfo()` to convert upstream configuration into network dial parameters

## Not responsible for

- Choosing which upstream to use for a given request (delegated to selection policies)
- Performing health checks (delegated to health-checks module)
- Performing the actual network connection (delegated to transport)
