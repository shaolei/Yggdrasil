# Selection Policies Internals

## Logic

### Hashing Algorithm

All hash-based policies use `hostByHashing()` which implements Highest Random Weight (HRW) / Rendezvous Hashing:
1. For each available upstream, compute `hash(upstream.String() + input)`
2. Select the upstream with the highest hash value
3. Uses xxhash (xxhash/v2) for fast, non-cryptographic hashing

HRW hashing provides stability when the upstream list changes: adding or removing a backend only redistributes the traffic that was going to/from that specific backend, minimizing disruption.

### Reservoir Sampling

`selectRandomHost()` and `LeastConnSelection.Select()` use reservoir sampling to select uniformly at random from an unknown number of available hosts in a single pass:
- Maintain a count of seen available hosts
- For the i-th available host, replace the current selection with probability 1/i
- This avoids needing to know the count of available hosts upfront or making two passes

### Cookie-Based Sticky Sessions

`CookieHashSelection.Select()`:
1. Check for existing cookie matching `s.Name`
2. If present: iterate available upstreams, compute `hashCookie(secret, upstream.Dial)`, compare to cookie value
3. If match found: return that upstream (sticky behavior)
4. If no match or no cookie: use fallback policy, set new cookie with HMAC-SHA256 of selected upstream's dial address
5. Cookie security: Secure=true and SameSite=None when TLS or behind trusted HTTPS proxy

Multiple query values for `QueryHashSelection` are joined with comma to prevent a client from controlling upstream selection by sending multiple values when the backend only considers the first.

### Round-Robin State

`RoundRobinSelection` uses `atomic.AddUint32` on a counter. Tries up to `len(pool)` positions before giving up, skipping unavailable hosts at each position. This means round-robin is not perfectly fair under partial availability, but is lock-free.

`WeightedRoundRobinSelection` maps the atomic counter modulo total weight to determine which weight bucket the current request falls into, then selects the corresponding available upstream.

## Decisions

- Chose Rendezvous/HRW hashing over consistent hash ring because HRW is simpler (no virtual nodes, no ring data structure) and provides the same minimal disruption property. rationale: unknown — inferred from code comments referencing literature.
- Chose xxhash over crypto hashes for the hashing function because selection policies are called on the hot path (every request) and cryptographic guarantees are unnecessary for load distribution. rationale: unknown — inferred from code.
- Chose reservoir sampling over pre-filtering available hosts into a list then selecting randomly because reservoir sampling is a single pass with no allocation, while pre-filtering would require allocating a slice of available hosts. rationale: unknown — inferred from code.
- Chose HMAC-SHA256 for cookie hashing over plain hashing because it prevents clients from predicting which cookie value maps to which upstream, which could be exploited to target specific backends. The secret is configurable.
- Chose to join multiple query parameter values with comma in QueryHashSelection over using only the first value because using only the first value would let clients control which upstream receives the request by sending multiple values of the same key. rationale: documented in code comment.
