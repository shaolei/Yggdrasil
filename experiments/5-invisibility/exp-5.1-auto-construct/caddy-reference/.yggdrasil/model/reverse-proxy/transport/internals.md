# Transport Internals

## Logic

### Transport Construction (`NewTransport`)

The `Provision` method calls `NewTransport` which builds an `http.Transport` step by step:

1. **Defaults**: Keep-alive probe 30s, idle timeout 2m, max 32 idle conns per host, dial timeout 3s
2. **Dialer**: Creates `net.Dialer` with timeout and fallback delay. If `local_address` is set, binds the local address.
3. **DNS Resolver**: If custom resolver configured, creates `net.Resolver` with `PreferGo: true` and random resolver selection for load distribution.
4. **Dial function**: Custom `dialContext` that:
   - Extracts `DialInfo` from context to get actual network/address (overriding the URL-based values)
   - Exception: if a forward proxy is in use AND the address is not unix, uses the proxy-provided address
   - Wraps connection errors in `DialError` for retry logic
   - Appends PROXY protocol header (v1/v2) if configured
   - Wraps TCP connections in `tcpRWTimeoutConn` if read/write timeouts configured
5. **Forward proxy**: Wraps `http.ProxyFromEnvironment` (or custom module) to track whether proxy is used per-request via context variable
6. **TLS**: Builds `tls.Config` from TLSConfig. If server name has placeholders OR PROXY protocol is enabled, uses custom `DialTLSContext` that does plaintext dial + manual TLS handshake (needed because PROXY protocol modifies the connection before TLS, and placeholder server names need per-request resolution)
7. **HTTP versions**:
   - HTTP/1.1 + 2: standard `http2.ConfigureTransport(rt)` setup
   - h2c: sets `rt.Protocols` to enable unencrypted HTTP/2, disables HTTP/1
   - HTTP/3: creates separate `http3.Transport` (experimental, must be exclusive)
8. **Compression**: `DisableCompression` set from config (default: enabled)

### PROXY Protocol

When `ProxyProtocol` is "v1" or "v2":
- Client address info is extracted from context (`ProxyProtocolInfo.AddrPort`)
- Destination address is set to all zeros (original destination is unknowable)
- Source and destination must be same address family (IPv4 or IPv6)
- Header is written to the raw connection immediately after dial, before any HTTP data
- When TLS is enabled, PROXY protocol header is sent on the plaintext connection before TLS handshake (via custom `DialTLSContext`)

### Request URL Encoding for PROXY Protocol

When PROXY protocol is enabled, `directRequest()` encodes the client address into the request URL host using `url.QueryEscape(clientAddr + "->" + host)`. This is necessary because HTTP/2 transports use the URL host to determine connection reuse. Without encoding, the separator characters would break Go's address parsing and cause new connections to be created per request (exhausting file descriptors, issue #7529).

### Read/Write Timeouts

`tcpRWTimeoutConn` wraps `*net.TCPConn` and sets read/write deadlines before each Read/Write call. Deadline-setting errors are logged but do not abort the I/O operation (consistent with stdlib behavior).

### Health Check Scheme Override

`OverrideHealthCheckScheme()` changes the health check URL scheme to "https" when TLS is enabled and the port is not in `ExceptPorts`. This ensures health checks use the same protocol as real traffic.

### Transport Header Operations

When TLS is enabled, `RequestHeaderOps()` returns a `HeaderOps` that sets the Host header to `{http.reverse_proxy.upstream.hostport}`. This ensures HTTPS backends receive the correct Host header matching the upstream's address rather than the client-facing hostname. This is applied before user-configured header operations so users can override it.

## Decisions

- Chose 3s default dial timeout over longer timeouts because a short timeout makes load-balancer retries more responsive — if one backend is down, the retry to the next backend happens quickly rather than waiting for a long timeout. Documented in code comment.
- Chose 32 max idle connections per host over other values based on benchmarking (referenced as "seems about optimal, see #2805"). rationale: unknown beyond code comment.
- Chose custom `DialTLSContext` when PROXY protocol is enabled over modifying `DialContext` because PROXY protocol headers must be sent on the raw TCP connection before the TLS handshake, which requires separating the plaintext dial from the TLS setup. Standard `http.Transport` combines these.
- Chose exclusive HTTP/3 (cannot mix with HTTP/1.1 or 2) because HTTP/3 requires fundamentally different transport (QUIC), and automatic fallback to lower versions would add latency and complexity. The assumption is that site owners control their backends and know which protocol version they support. rationale: documented in code comment.
- Chose `http.ProxyFromEnvironment` as default forward proxy over no proxy because it aligns with standard Go behavior and respects existing HTTP_PROXY/HTTPS_PROXY environment variables.
