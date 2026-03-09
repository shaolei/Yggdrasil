# HTTP Transport Internals

## Logic

### Custom DialTLSContext

A custom `DialTLSContext` function is used when either:
1. The TLS ServerName contains placeholders (needs per-request replacement), OR
2. PROXY protocol is enabled (because the `req.URL.Host` is modified to include client address info with "->" separator, which breaks Go's standard address parsing for TLS SNI).

In both cases, the custom function first dials a plaintext connection (reusing the standard dialer, which also handles PROXY protocol header sending), then manually performs the TLS handshake.

### PROXY Protocol

When configured, the `dialContext` function appends a PROXY protocol header after establishing the TCP connection. Source and destination addresses must be the same address family. Since the original destination address is unknown, it is set to all zeros (IPv4zero or IPv6zero).

### Keep-Alive Configuration

The code comments note the distinction between TCP keep-alive (OS-level probe packets) and HTTP keep-alive (connection reuse for multiple requests). The `MaxIdleConnsPerHost` default of 32 is noted as "seems about optimal, see #2805".

### Forward Proxy

The `proxyWrapper` function wraps the configured proxy function to track whether a proxy is being used for a given request (stored as a context variable). This is needed because the dialer needs to know whether to use the dial info address or the proxy address.

## Decisions

- **Custom DialTLSContext for proxy protocol**: Needed because when proxy protocol is enabled, `req.URL.Host` is modified to include client address info (e.g., `1.2.3.4:5678->backend:443`), which causes Go's standard TLS dialer to fail when parsing the address for SNI. Source: commit d7b21c6 / PR #7508.
- **3s default dial timeout**: Described as "relatively short" to "make load-balancer retries more speedy." Source: code comment. Rationale: unknown beyond this comment.
- **32 max idle connections per host**: Source: code comment referencing issue #2805. Rationale: "seems about optimal".
- **HTTP/3 must be exclusive**: No automatic fallback to lower versions. Code comment: "that'd add latency and complexity, besides, we expect that site owners control the backends." Source: code comment.
- **nil proxy check in proxyWrapper**: Added to avoid nil pointer dereference when the proxy function is nil. Source: commit 9798f69 / PR #7521.
