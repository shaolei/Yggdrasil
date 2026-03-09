# Transport Interface

## HTTPTransport

Module ID: `http.reverse_proxy.transport.http`

Implements: `http.RoundTripper`, `caddy.Provisioner`, `caddy.CleanerUpper`, `TLSTransport`, `H2CTransport`, `HealthCheckSchemeOverriderTransport`, `ProxyProtocolTransport`

### RoundTrip

```go
func (h *HTTPTransport) RoundTrip(req *http.Request) (*http.Response, error)
```

Sets the URL scheme (http/https) and delegates to either the HTTP/3 transport or the standard `http.Transport`.

### Configuration Fields

| Field | Type | Default | Description |
|---|---|---|---|
| `tls` | TLSConfig | nil | TLS config for upstream; nil = plaintext HTTP |
| `keep_alive` | KeepAlive | enabled, 30s probe, 32 idle/host | HTTP keep-alive settings |
| `compression` | *bool | true | Enable compression to upstream |
| `max_conns_per_host` | int | 0 (unlimited) | Max connections per host |
| `proxy_protocol` | string | "" | PROXY protocol version: "v1" or "v2" |
| `dial_timeout` | duration | 3s | Connection establishment timeout |
| `dial_fallback_delay` | duration | 300ms | RFC 6555 Fast Fallback delay |
| `response_header_timeout` | duration | 0 | Timeout for response headers |
| `versions` | []string | ["1.1", "2"] | HTTP versions to support; "h2c" and "3" also available |
| `resolver` | UpstreamResolver | nil | Custom DNS resolver |
| `local_address` | string | "" | Local address to bind for outgoing connections |
| `read_timeout` | duration | 0 | Per-read timeout on TCP connections |
| `write_timeout` | duration | 0 | Per-write timeout on TCP connections |
| `network_proxy` | module | env vars | Forward proxy (HTTP_PROXY/HTTPS_PROXY) |

### TLSConfig

```go
type TLSConfig struct {
    CARaw                    json.RawMessage // CA certificate pool module
    RootCAPool               []string        // Deprecated: base64 DER certs
    RootCAPEMFiles           []string        // Deprecated: PEM cert files
    ClientCertificateFile    string          // Client cert for mTLS
    ClientCertificateKeyFile string          // Client cert key
    ClientCertificateAutomate string         // Auto-managed client cert
    InsecureSkipVerify       bool            // Skip TLS verification (testing only)
    HandshakeTimeout         caddy.Duration  // TLS handshake timeout
    ServerName               string          // Override SNI server name
    Renegotiation            string          // never|once|freely
    ExceptPorts              []string        // Ports to skip TLS
    Curves                   []string        // Elliptic curves
}
```

`MakeTLSClientConfig(ctx) (*tls.Config, error)` — builds a `tls.Config` from the above fields.

### KeepAlive

```go
type KeepAlive struct {
    Enabled             *bool          // Default: true
    ProbeInterval       caddy.Duration // Default: 30s
    MaxIdleConns        int            // Default: 0 (unlimited)
    MaxIdleConnsPerHost int            // Default: 32
    IdleConnTimeout     caddy.Duration // Default: 2m
}
```

### Helper Methods

- `SetScheme(req)` — sets req.URL.Scheme to "http" or "https" based on TLS config
- `TLSEnabled() bool` — returns true if TLS is configured
- `EnableTLS(base *TLSConfig) error` — enables TLS with given base config
- `EnableH2C() error` — sets versions to ["h2c", "2"]
- `OverrideHealthCheckScheme(url, port)` — changes health check URL to HTTPS when TLS enabled
- `ProxyProtocolEnabled() bool` — true if PROXY protocol is configured
- `RequestHeaderOps() *headers.HeaderOps` — returns Host header override ops when TLS is enabled
- `Cleanup() error` — closes idle connections

## Failure Modes

- `DialError` wraps connection failures for retry decisions by the Handler
- Unsupported HTTP version strings cause provision error
- HTTP/3 must be the only version specified (cannot mix with 1.1/2)
- Invalid local_address causes provision error
- TLS handshake failures are returned from RoundTrip
