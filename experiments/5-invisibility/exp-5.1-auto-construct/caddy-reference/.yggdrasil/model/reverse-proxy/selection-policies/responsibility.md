# Selection Policies

Implements the `Selector` interface with 12 load balancing strategies for choosing which available backend receives each request.

## Responsible for

- Providing pluggable load balancing algorithms via the Caddy module system
- Selecting a single upstream from the pool for each proxy attempt
- Ensuring only available (healthy and not full) upstreams are considered
- Supporting both stateless (random, hash-based) and stateful (round-robin, least-conn) strategies
- Supporting sticky sessions via cookie-based affinity

## Not responsible for

- Determining upstream availability (delegated to `Upstream.Available()`)
- Managing upstream state (request counts, health status)
- Retry logic or fallback when no upstream is available (handled by Handler)
