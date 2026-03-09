# Selection Policies

## Identity

A collection of load-balancing selection policies, each registered as a Caddy module under the `http.reverse_proxy.selection_policies.*` namespace. All implement the `Selector` interface.

## Responsibilities

- Provide 12 upstream selection algorithms: random, random_choose, least_conn, round_robin, weighted_round_robin, first, ip_hash, client_ip_hash, uri_hash, query (hash), header (hash), cookie (sticky sessions).
- Each policy selects one available upstream from the pool per request.
- Hash-based policies provide consistent upstream selection using Rendezvous (HRW) hashing for stability when upstream lists change.
- Cookie policy provides sticky sessions via HMAC-SHA256 hashed cookies with optional secret, max-age, and secure/SameSite attributes.
- Policies with missing hash keys (query, header, cookie) fall back to a configurable fallback policy (default: random).
- Helper functions: `selectRandomHost` (reservoir sampling), `leastRequests`, `hostByHashing` (rendezvous hashing with xxhash).

## Not responsible for

- Determining which upstreams are available (that is the Upstream/Host's `Available()` method).
- Health check tracking (that is the health checks module).
- The retry loop (that is the Handler).
