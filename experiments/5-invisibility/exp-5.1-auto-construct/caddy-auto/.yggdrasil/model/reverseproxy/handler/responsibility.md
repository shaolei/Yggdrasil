# Handler

## Identity

The Handler is the central orchestrator of the Caddy reverse proxy. It is registered as `http.handlers.reverse_proxy` and implements the `caddyhttp.MiddlewareHandler` interface.

## Responsibilities

- Receive incoming HTTP requests and prepare them for proxying (cloning, header manipulation, body buffering).
- Manage the retry loop: select an upstream, attempt the proxy, retry on failure with configurable duration/interval/count.
- Coordinate with load balancing selection policies, health checks, transport, and streaming subsystems.
- Set X-Forwarded-For, X-Forwarded-Proto, X-Forwarded-Host headers based on trusted proxy configuration.
- Handle WebSocket upgrade detection and protocol conversion (HTTP/2 extended CONNECT to HTTP/1.1 upgrade).
- Track in-flight requests globally via a lock-free sync.Map for admin API visibility.
- Expose placeholders for upstream metadata (address, host, port, latency, duration, retries).
- Handle response routing via `handle_response` matchers for custom response processing.
- Manage connection lifecycle: register hijacked connections for cleanup on server shutdown.

## Not responsible for

- The actual network transport (delegated to HTTPTransport or other transport modules).
- DNS-based upstream discovery (delegated to upstream source modules like SRVUpstreams, AUpstreams).
- The specifics of upstream selection algorithms (delegated to selection policy modules).
- Active health check execution (delegated to health check subsystem, though Handler starts the goroutine).
- Low-level streaming and WebSocket protocol details (delegated to streaming module).
