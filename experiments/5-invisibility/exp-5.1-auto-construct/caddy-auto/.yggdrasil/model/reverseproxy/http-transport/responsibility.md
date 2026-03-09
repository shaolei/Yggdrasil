# HTTP Transport

## Identity

Registered as `http.reverse_proxy.transport.http`. A configuration wrapper around Go's `http.Transport` that provides the actual network round-trip to backends.

## Responsibilities

- Configure and build an `http.Transport` with TLS, keep-alive, compression, timeouts, and HTTP version settings.
- Support PROXY protocol (v1 and v2) for forwarding client connection information to backends.
- Handle custom DNS resolution for upstream addresses.
- Support HTTP/1.1, HTTP/2, H2C (HTTP/2 over cleartext), and HTTP/3 (experimental, exclusive).
- Provide TLS client configuration: CA certificates, client certificates (file-based and automated), server name verification, renegotiation control, curve preferences.
- Wrap TCP connections with read/write timeout enforcement.
- Set request URL scheme (http/https) based on TLS configuration.
- Provide default Host header operations when TLS is enabled (set Host to upstream hostport placeholder).
- Implement `HealthCheckSchemeOverriderTransport` to set HTTPS scheme for health checks when TLS is configured.
- Support forward/network proxy configuration for proxying through intermediate servers.

## Not responsible for

- Selecting which upstream to connect to (that is the Handler/selection policy).
- Managing the retry loop or health checks.
- WebSocket/streaming protocol handling (that is the streaming module).
