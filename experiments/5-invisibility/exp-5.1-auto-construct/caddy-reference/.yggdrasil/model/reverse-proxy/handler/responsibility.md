# Handler

The Handler is the central orchestrator of the reverse proxy. It implements `caddyhttp.MiddlewareHandler` and is responsible for the complete lifecycle of proxying a request: preparation, upstream selection, round-tripping, response handling, and retry logic.

## Responsible for

- Cloning and preparing inbound requests for proxying (stripping hop-by-hop headers, setting X-Forwarded-* headers, buffering bodies)
- Managing the proxy retry loop: selecting upstreams, attempting round-trips, counting failures, deciding whether to retry
- Handling protocol upgrades (WebSocket, h2c) via connection hijacking and bidirectional streaming
- Processing response handlers (`handle_response` routes) for conditional response manipulation
- Finalizing responses: copying headers, streaming body to client, handling trailers
- Managing hijacked connections for graceful shutdown (with optional `stream_close_delay`)
- Setting upstream-related placeholders for use in response headers and logging
- Provisioning all sub-modules (transport, selection policy, circuit breaker, dynamic upstreams, health checks)

## Not responsible for

- The actual HTTP round-trip to the backend (delegated to Transport)
- Deciding which upstream to select (delegated to SelectionPolicy)
- Active health check scheduling (delegated to health-checks, though it starts the goroutine)
- DNS-based upstream resolution (delegated to upstreams module)
