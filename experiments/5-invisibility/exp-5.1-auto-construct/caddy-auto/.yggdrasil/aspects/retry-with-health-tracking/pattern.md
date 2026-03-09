# Retry with Health Tracking

The reverse proxy implements a retry loop where:

1. Each iteration selects an upstream via the load balancing policy.
2. If the proxy attempt fails, the failure is counted (passive health check).
3. The loop re-selects an upstream (possibly different) for the next attempt.
4. Retries continue for `try_duration` or `retries` count, whichever is configured.
5. Between retries, there is a configurable `try_interval` (default 250ms if try_duration > 0) to avoid CPU spinning for local/low-latency upstreams.
6. Request bodies are preserved across retries: when retries are configured, the body is wrapped in `io.NopCloser` to prevent Go's transport from closing it on dial errors. Fully buffered bodies (via `request_buffers`) are replayed from the beginning on each attempt.

The connection between retries and health tracking is that `countFailure()` is called after each failed proxy attempt, which feeds into passive health check state. This state is then visible to selection policies (e.g., `LeastConnSelection` considers request counts).
