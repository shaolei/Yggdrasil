# Selection Policies Internals

## Logic

### Reservoir Sampling

Both `selectRandomHost` and `LeastConnSelection.Select` use reservoir sampling to randomly select among candidates without knowing the pool size upfront. This works correctly with upstream pools where availability is checked inline.

### Rendezvous Hashing

`hostByHashing` implements Highest Random Weight (HRW) hashing: for each available upstream, compute `hash(upstream.String() + key)` and select the upstream with the highest hash value. This provides:
- Consistent mapping: same key always maps to same upstream (if available).
- Minimal disruption: adding/removing an upstream only affects requests that mapped to it.

Uses xxhash (cespare/xxhash/v2) for fast, non-cryptographic hashing.

### Query Hash Security

The QueryHashSelection joins multiple values for the same key with "," before hashing. This prevents a client from controlling upstream selection by sending multiple values where the upstream only considers the first. The comment notes that changing value order is semantically different (order is significant).

### Weighted Round Robin

Uses atomic counter modulo total weight. Skips upstreams with weight=0 and unavailable upstreams. Creates a filtered list of available upstreams with non-zero weights.

## Decisions

- **Rendezvous hashing over consistent hashing**: rationale: unknown -- inferred from code comments referencing Wikipedia and blog posts about Rendezvous hashing. The code comments cite stability guarantees when upstream lists change.
- **xxhash over other hash functions**: rationale: unknown -- inferred from code. xxhash is a fast non-cryptographic hash suitable for load balancing.
- **HMAC-SHA256 for cookie values**: rationale: unknown -- inferred from code. Prevents clients from guessing or forging upstream assignments when a secret is configured.
