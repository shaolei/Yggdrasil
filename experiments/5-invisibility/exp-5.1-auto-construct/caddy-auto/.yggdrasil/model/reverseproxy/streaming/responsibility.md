# Streaming

## Identity

Handles protocol upgrades (WebSocket, etc.), bidirectional streaming, response body copying, and connection lifecycle management. These are methods on the Handler type, not a separately registered Caddy module.

## Responsibilities

- Handle HTTP 101 Switching Protocols responses: hijack the client connection, establish bidirectional data copying between client and backend.
- Support WebSocket over HTTP/2 and HTTP/3 via the extended CONNECT mechanism, converting to HTTP/1.1 upgrade for backends that don't support it.
- Manage response body flushing with configurable intervals, including immediate flushing for SSE (text/event-stream) and streaming responses (Content-Length -1).
- Detect bidirectional streaming for h2/h2c upstreams.
- Register and track hijacked connections for graceful cleanup on server shutdown.
- Send WebSocket Close control frames for graceful connection teardown, with proper client-side message masking per RFC 6455.
- Manage connection close timing via `StreamCloseDelay` to avoid thundering herd of reconnections on config reload.

## Not responsible for

- The initial proxy round-trip (that is the Handler + Transport).
- Upstream selection or health checking.
- The HTTP transport layer configuration.
