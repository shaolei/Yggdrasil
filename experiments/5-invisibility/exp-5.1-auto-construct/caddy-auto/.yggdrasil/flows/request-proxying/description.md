# Request Proxying

## Business context

The reverse proxy receives HTTP requests from clients and forwards them to one or more backend servers (upstreams). It handles load balancing, health checking, retries, protocol upgrades (WebSocket), and response streaming.

## Trigger

An incoming HTTP request matches a route configured with the `reverse_proxy` handler.

## Goal

Deliver the client's request to a healthy backend, return the backend's response to the client, and maintain awareness of backend health for future requests.

## Participants

- **Handler** (reverseproxy/handler): Orchestrates the entire proxy flow — prepares requests, manages the retry loop, selects upstreams, invokes the transport, and handles responses.
- **Selection Policies** (reverseproxy/selection-policies): Choose which upstream to send the request to based on various algorithms (random, round-robin, least-conn, hash-based, cookie-based sticky sessions).
- **Health Checks** (reverseproxy/healthchecks): Monitor upstream health via active (background HTTP probes) and passive (counting failures during proxying) mechanisms.
- **HTTP Transport** (reverseproxy/http-transport): Manages the actual HTTP connection to backends — TLS, keep-alive, proxy protocol, HTTP version negotiation, timeouts.
- **Streaming** (reverseproxy/streaming): Handles WebSocket upgrades, bidirectional streaming, response flushing, and connection lifecycle management during protocol switches.
- **Upstreams** (reverseproxy/upstreams): Provide dynamic upstream lists via DNS lookups (SRV, A/AAAA records) with caching and refresh.

## Paths

### Happy path

1. Handler receives the request and prepares a clone for proxying.
2. If dynamic upstreams are configured, the upstream source is queried for the current list.
3. The selection policy chooses an available upstream from the pool.
4. The handler sets up dial info, headers (X-Forwarded-*, Host), and request modifications.
5. The transport establishes a connection and performs the round-trip.
6. If the response is a protocol upgrade (101), streaming takes over for bidirectional data copying.
7. Otherwise, the response headers and body are streamed to the client with configurable flush intervals.

### Retry path

1. If the round-trip fails and retries are configured, the handler counts the failure (passive health check).
2. The loop re-selects an upstream (possibly different, since the failed one may now be marked down).
3. Request body is replayed if buffered; otherwise, the body wrapper prevents premature close.
4. This repeats until success, max retries, or try_duration is exceeded.

### Health check path (background)

1. Active health checker runs on a timer (default 30s interval).
2. For each static upstream, it sends an HTTP request to the health check endpoint.
3. Based on status code, body regex match, and consecutive pass/fail counts, it marks upstreams healthy or unhealthy.
4. Health/unhealthy events are emitted for observability.

## Invariants across all paths

- Hop-by-hop headers are never forwarded.
- X-Forwarded-For, X-Forwarded-Proto, X-Forwarded-Host are set based on trust configuration.
- WebSocket header casing is normalized to RFC 6455 standard (uppercase 'S' in WebSocket).
- Buffered request bodies are returned to the pool after use.
- Hijacked connections (WebSocket, protocol upgrades) are registered for cleanup on server shutdown.
