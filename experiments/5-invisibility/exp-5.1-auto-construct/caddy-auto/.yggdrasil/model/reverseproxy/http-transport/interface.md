# HTTP Transport Interface

## Public API

### `RoundTrip(req *http.Request) (*http.Response, error)`

Performs the HTTP round-trip. Sets the URL scheme, then delegates to HTTP/3 transport if enabled, otherwise to the standard `http.Transport`.

### `Provision(ctx caddy.Context) error`

Validates HTTP versions, builds the transport via `NewTransport()`.

### `NewTransport(caddyCtx caddy.Context) (*http.Transport, error)`

Builds a fully configured `http.Transport`. This is the core method.

### `SetScheme(req *http.Request)`

Ensures the request URL has a scheme set (http or https based on TLS config).

### `TLSEnabled() bool` / `EnableTLS(base *TLSConfig) error`

TLS state inspection and configuration.

### `EnableH2C() error`

Sets versions to h2c+2 for HTTP/2 cleartext support.

### `Cleanup() error`

Closes idle connections.

## Configuration (JSON)

| Field | Type | Default | Description |
|---|---|---|---|
| `tls` | TLSConfig | nil | TLS configuration (nil = plaintext) |
| `keep_alive` | KeepAlive | enabled | Connection keep-alive settings |
| `compression` | *bool | true | Enable compression to upstream |
| `max_conns_per_host` | int | 0 | Max connections per host (0 = unlimited) |
| `proxy_protocol` | string | "" | PROXY protocol version ("v1" or "v2") |
| `dial_timeout` | duration | 3s | Connection timeout |
| `dial_fallback_delay` | duration | 300ms | RFC 6555 Fast Fallback delay |
| `response_header_timeout` | duration | 0 | Response header read timeout |
| `read_timeout` | duration | 0 | Per-read timeout for TCP connections |
| `write_timeout` | duration | 0 | Per-write timeout for TCP connections |
| `versions` | []string | ["1.1","2"] | HTTP versions to support |
| `local_address` | string | "" | Source address for outgoing connections |
| `resolver` | UpstreamResolver | nil | Custom DNS resolver |
| `network_proxy` | module | env vars | Forward proxy configuration |

## Implemented Interfaces

- `http.RoundTripper`
- `caddy.Provisioner`
- `caddy.CleanerUpper`
- `TLSTransport`
- `H2CTransport`
- `HealthCheckSchemeOverriderTransport`
- `ProxyProtocolTransport`

## Failure Modes

- Dial errors are wrapped in `DialError` to distinguish them from other errors (important for retry decisions).
- PROXY protocol header write failure is also wrapped as `DialError`.
- Unsupported HTTP versions cause a provision-time error with the list of allowed versions.
- HTTP/3 cannot be combined with other versions (provision-time error).
