# Hop-by-Hop Header Stripping

## What

Both request preparation (`prepareRequest`) and response finalization (`finalizeResponse`) strip hop-by-hop headers as defined in RFC 7230 section 6.1. The `hopHeaders` list includes: Alt-Svc, Connection, Proxy-Connection, Keep-Alive, Proxy-Authenticate, Proxy-Authorization, Te, Trailer, Transfer-Encoding, and Upgrade.

Additionally, `removeConnectionHeaders` parses the Connection header to find and remove any additional hop-by-hop headers declared dynamically.

## Special case: Upgrade

After stripping, if the original request contained an Upgrade header (e.g., for WebSocket), the Connection and Upgrade headers are restored on the outbound request. The Te header is also preserved if it contains "trailers" (per Go issue #21096).

## Why

Hop-by-hop headers are meaningful only for a single transport-level connection and must not be forwarded by proxies. This is a fundamental HTTP proxy correctness requirement. The selective restoration of Upgrade headers enables protocol switching (WebSocket, h2c) while maintaining proxy correctness.
