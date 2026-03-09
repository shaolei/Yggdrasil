# Streaming Interface

## Key Methods (on Handler)

### `handleUpgradeResponse(logger, wg, rw, req, res)`

Handles 101 Switching Protocols responses. Validates upgrade type match, hijacks the client connection (or uses h2ReadWriteCloser for HTTP/2 WebSocket), registers both connections for cleanup, starts bidirectional copy goroutines.

### `copyResponse(dst, src, flushInterval, logger) error`

Copies response body to the client with configurable flush intervals. Uses `maxLatencyWriter` for periodic flushing and a pooled 32KB buffer.

### `flushInterval(req, res) time.Duration`

Determines the flush interval for a response:
- SSE (text/event-stream): immediate (-1)
- Unknown content length (-1): immediate
- Bidirectional h2 stream: immediate
- Otherwise: configured `FlushInterval`

### `registerConnection(conn, gracefulClose) func()`

Registers a hijacked connection for cleanup. Returns a delete function. If all connections close before the close timer fires, the timer is stopped.

### `cleanupConnections() error`

Called during Handler cleanup. If `StreamCloseDelay` is 0, closes connections immediately. Otherwise, sets a timer to close them after the delay.

### `closeConnections() error`

Immediately closes all registered connections, calling graceful close functions first (WebSocket Close frames).

## Internal Types

- **maxLatencyWriter**: Wraps a writer with periodic flushing. Negative latency = flush immediately. Uses timer-based delayed flush with mutex protection.
- **switchProtocolCopier**: Named struct for goroutines doing bidirectional copy (for readable stack traces).
- **h2ReadWriteCloser**: Wraps HTTP/2 response writer + request body for WebSocket over HTTP/2.
- **openConnection**: Maps a connection to its optional graceful close function.

## Constants

- `defaultBufferSize` = 32KB (for streaming buffer pool)

## Failure Modes

- Backend upgrade type mismatch: logged and connection not upgraded.
- Hijack not supported: logged (HTTP/2 connections are not hijackable, handled via h2ReadWriteCloser instead).
- Stream timeout: bidirectional copy is terminated after `StreamTimeout`.
- Buffered data in bufio.Reader after hijack: explicitly forwarded to backend to prevent data loss (see issue #6273).
