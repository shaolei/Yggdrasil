# Streaming Internals

## Logic

### WebSocket Close Frame

`writeCloseControl` sends a best-effort Close control frame per RFC 6455:
- Uses status code 1001 (Going Away).
- Client-side messages must be masked (per RFC 6455 section 5.3).
- Server-side messages are sent unmasked.
- Masking key is a random 4-byte value.

The `maskBytes` function is copied from gorilla/websocket with word-size aligned optimizations using `unsafe.Pointer` arithmetic.

### Connection Lifecycle on Shutdown

When the Handler is cleaned up (config reload):
1. If `StreamCloseDelay == 0`: immediately close all connections.
2. If `StreamCloseDelay > 0`: set a timer; if all connections close naturally before the timer fires, cancel the timer.
3. Connections are tracked in a map protected by a mutex.
4. Graceful close functions (WebSocket Close frames) are called before forced close.

### Error Channel Buffer Size

The `errc` channel in `handleUpgradeResponse` has buffer size 2, allowing both copy goroutines to send their error and exit even when a stream timeout is encountered (no reader on errc). See issue #7418.

### Bidirectional Stream Detection

A response is considered bidirectional streaming when: request is HTTP/2, response is HTTP/2, Content-Length is -1, and Accept-Encoding is identity or empty. This avoids interaction with the `encode` directive which might add Content-Encoding headers.

## Decisions

- **Buffer size 2 for errc channel**: Without this, one goroutine would block forever on send when a stream timeout fires (since the select exits and nobody reads errc). Source: code comment referencing issue #7418.
- **Buffered data forwarding after hijack**: After hijacking, the bufio.Reader may contain buffered data that was read ahead but not yet consumed. This data is explicitly peeked and written to the backend. Source: code comment referencing issue #6273.
- **WebSocket header normalization**: RFC 6455 uses "WebSocket" (uppercase S), but Go's canonical header form uses "Websocket" (lowercase s). Some backends are case-sensitive, so headers are normalized. Source: code comment referencing PR #6621.
- **Most code initially borrowed from Go standard library**: The file header notes this explicitly, with the original Go Authors copyright.
