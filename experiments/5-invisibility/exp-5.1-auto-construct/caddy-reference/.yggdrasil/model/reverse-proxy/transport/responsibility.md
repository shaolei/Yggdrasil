# Transport

Configures and performs the actual HTTP round-trip to backend servers. Wraps Go's `http.Transport` with additional features: custom DNS resolution, TLS configuration, PROXY protocol support, HTTP/2 (h2c), HTTP/3, read/write timeouts, and keep-alive management.

## Responsible for

- Building and configuring `http.Transport` from JSON/Caddyfile configuration
- Performing HTTP round-trips to backends (`RoundTrip`)
- Managing TLS configuration for upstream connections (client certs, CA pools, server name, renegotiation)
- Supporting HTTP version negotiation: HTTP/1.1, HTTP/2, h2c (HTTP/2 cleartext), HTTP/3 (experimental)
- Implementing PROXY protocol v1/v2 header generation on upstream connections
- Setting the URL scheme (http/https) based on TLS configuration
- Providing transport-level header operations (e.g., setting Host header when TLS is enabled)
- Supporting custom DNS resolvers for upstream hostname resolution
- Managing connection keep-alive, idle timeouts, and connection pooling
- Enforcing per-connection read/write timeouts via `tcpRWTimeoutConn`
- Providing the scheme override for active health checks via `OverrideHealthCheckScheme`

## Not responsible for

- Deciding which upstream to connect to (handled by Handler + selection policy)
- Request preparation or header manipulation beyond scheme setting (handled by Handler)
- Managing upstream health state (handled by health-checks and upstreams)
