# Dynamic Upstreams

## Identity

Provides DNS-based dynamic upstream discovery. Three Caddy modules registered under `http.reverse_proxy.upstreams.*`:
- `SRVUpstreams` (`.srv`): Discovers upstreams via DNS SRV record lookups.
- `AUpstreams` (`.a`): Discovers upstreams via DNS A/AAAA record lookups.
- `MultiUpstreams` (`.multi`): Aggregates results from multiple upstream sources.

## Responsibilities

- Perform DNS lookups (SRV, A/AAAA) to discover backend addresses dynamically.
- Cache DNS results with configurable refresh intervals (default 1 minute).
- Support custom DNS resolvers with random selection from configured addresses.
- Support configurable IP version filtering (IPv4-only, IPv6-only, or both) for A lookups.
- Support SRV grace periods for returning stale results on DNS lookup failure.
- MultiUpstreams: aggregate upstreams from multiple sources, logging errors per source and continuing to the next.
- Parse and validate resolver network addresses.

## Not responsible for

- Health checking of discovered upstreams (that is the health checks module).
- Upstream selection (that is the selection policies module).
- Managing upstream state (that is the Host/Upstream types in the handler).
