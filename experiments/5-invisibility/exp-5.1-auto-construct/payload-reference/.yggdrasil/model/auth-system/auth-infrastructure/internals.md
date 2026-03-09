# Auth Infrastructure — Internals

## Logic

### Password hashing parameters

- Algorithm: pbkdf2
- Iterations: 25000
- Key length: 512 bytes
- Digest: sha256
- Salt: 32 random bytes, stored as hex string
- Hash: stored as hex string

Both `authenticateLocalStrategy` and `generatePasswordSaltHash` use identical pbkdf2 parameters. The authentication function additionally checks buffer length equality before `timingSafeEqual`.

### JWT extraction order

The extraction order is configurable via `payload.config.auth.jwtOrder` (array). Each method is tried in order; first non-null result wins. The cookie extraction includes CSRF protection: if an `Origin` header is present and `config.csrf` has entries, the origin must be in the allowed list.

### API key dual-hash backward compatibility

API keys stored before v3.46.0 used SHA-1 HMAC. Current code computes both SHA-1 and SHA-256 indices and queries with `OR` to match either. There is a TODO comment to remove the SHA-1 check in v4.

### getFieldsToSign field traversal

Recursively traverses collection fields:
- `saveToJWT: true` — include field with its original name
- `saveToJWT: "alias"` — include field with the alias as key
- `saveToJWT: false` — explicitly exclude
- No `saveToJWT` — exclude by default

Handles nested field types: groups, tabs (named and unnamed), collapsible, row. Named groups/tabs create nested objects in the JWT payload if they have `saveToJWT`.

### Session management invariants

- Sessions are stored as an array on the user document (not a separate collection)
- Session IDs are UUID v4
- Adding a session always cleans expired sessions first
- `updatedAt` is set to `null` during session-only updates to preserve the document's semantic "last modified" timestamp
- Session expiration matches `tokenExpiration` from collection auth config

### encrypt/decrypt binding

Both `encrypt` and `decrypt` use `this.secret` — they must be called with correct `this` binding (bound to the Payload instance). The `@ts-expect-error` comments indicate this is legacy code from before strict TypeScript was adopted.

## Decisions

- Chose pbkdf2 over bcrypt/argon2 — rationale: unknown — inferred from code. pbkdf2 is available natively in Node.js crypto without external dependencies.
- Chose 25000 iterations — rationale: unknown — inferred from code. This was likely a reasonable default at the time of implementation; OWASP currently recommends 600,000+ for SHA-256.
- Chose SHA-256 HMAC for API key indexing over storing hashed keys directly — rationale: unknown — inferred from code. HMAC with server secret means the index changes if the secret changes, preventing rainbow table attacks across different Payload instances.
- Chose to keep SHA-1 backward compatibility over requiring key regeneration on upgrade — rationale: observable in TODO comment, planned removal in v4.
- Chose UUID v4 for session IDs over sequential/timestamp-based IDs — rationale: unknown — inferred from code. UUIDs are unguessable, which matters for session security.
- Chose to store sessions on user document over separate sessions collection — rationale: unknown — inferred from code. Simplifies queries (no joins) but limits scalability for users with many concurrent sessions.
- Chose SameSite=Strict as default when `cookies.sameSite` is boolean true over SameSite=Lax — rationale: unknown — inferred from code. Strict provides stronger CSRF protection at the cost of breaking cross-origin navigation with cookies.
