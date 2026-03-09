# Diagnostic Questions — Caddy Reverse Proxy

## Factual (F1-F3)

**F1**: What are the 12 load balancing selection policies available, and what algorithm does each use to choose an upstream?

**F2**: What happens during the `handleUpgradeResponse` flow when a WebSocket connection is established? Describe the complete sequence from receiving the 101 response through bidirectional data transfer.

**F3**: How does the `SRVUpstreams.GetUpstreams()` method handle concurrent access to the DNS cache, and what happens when a DNS lookup fails?

## Structural (S1-S3)

**S1**: Trace the data flow from when `ServeHTTP` is called to when a response is written back to the client, identifying each component involved and what it contributes.

**S2**: How do active and passive health checks interact? Specifically, how does their state storage differ (per-handler vs global), and why?

**S3**: How does the selection policy interact with the upstream availability system? What methods does a policy call, and what is the chain of checks that determines if an upstream can receive traffic?

## Rationale (R1-R3)

**R1**: Why does the Handler use `io.NopCloser` to wrap request bodies when retries are configured, and why is buffered body handling different from unbuffered?

**R2**: Why does the `HTTPTransport` use a custom `DialTLSContext` when PROXY protocol is enabled, instead of the standard transport's built-in TLS handling?

**R3**: Why does `QueryHashSelection` join multiple values of the same query key with a comma instead of using just the first value?

## Impact (I1-I3)

**I1**: What would break if the `Available()` method on `Upstream` were removed or its semantics changed to not check `Full()`?

**I2**: What would be affected if the `hostByHashing` function were changed from Rendezvous/HRW hashing to simple modulo hashing?

**I3**: If the `Host` struct fields were changed from atomic operations to mutex-protected fields, what performance impact would this have and which hot paths would be affected?

## Counterfactual (C1-C3)

**C1**: Why wasn't a simple LRU cache used for DNS results in `SRVUpstreams` and `AUpstreams` instead of the current random-eviction approach?

**C2**: Why doesn't the reverse proxy use HTTP/3 as a fallback alongside HTTP/1.1 and HTTP/2, like web browsers do?

**C3**: Why are dynamic upstream hosts tracked in a separate time-evicted map instead of using the same `caddy.UsagePool` as static upstreams?
