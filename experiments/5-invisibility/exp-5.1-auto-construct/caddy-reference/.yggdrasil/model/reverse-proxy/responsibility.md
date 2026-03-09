# Reverse Proxy

The reverse proxy module (`modules/caddyhttp/reverseproxy/`) provides a production-grade HTTP reverse proxy for the Caddy web server. It is responsible for forwarding client requests to one or more backend servers and relaying responses back to the client.

## Responsible for

- Proxying HTTP requests to upstream backends with configurable transport, load balancing, and health checking
- Supporting protocol upgrades (WebSocket, h2c) including HTTP/2 and HTTP/3 extended CONNECT
- Managing upstream state (health, request counts, failures) across config reloads
- Providing extensibility via Caddy's module system: pluggable transports, selection policies, upstream sources, and circuit breakers

## Not responsible for

- TLS termination for incoming connections (handled by Caddy's listener)
- HTTP routing/matching (handled by Caddy's HTTP app and route matchers)
- FastCGI or forward auth protocols (separate subdirectories with their own modules)
- DNS resolution infrastructure (delegates to Go's net.Resolver or custom resolvers)
