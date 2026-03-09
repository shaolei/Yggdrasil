# Git Extraction Notes — Caddy Reverse Proxy

## Summary

- **Total commits analyzed**: 11 commits touching the 6 target files
- **Date range**: Feb 16, 2026 -- Mar 4, 2026 (recent history only; these files have much older history not captured by `--all` on this shallow-ish clone)
- **Commits with useful multi-line messages**: 4 of 11 (36%)
- **Commits with WHY information**: 5 of 11 (45%)

## Commit Classification

| Commit | File(s) | WHY Info? | Type |
|---|---|---|---|
| 6e5e08c | httptransport.go | No | Minor: add timeout cause message |
| a5e7c6e | reverseproxy.go | **Yes** | Bug fix: body close on dial-error retries. Detailed comment explains shared ReadCloser problem. References #6259, #7546. |
| db29860 | reverseproxy.go | **Yes** | Feature: dynamic upstream tracking with last-seen timestamps instead of reference counting. Comment explains why. |
| 88616e8 | reverseproxy.go | **Yes** | Feature: in-flight request tracking. Explains design choice (sync.Map+atomic.Int64 over sync.RWMutex for lock contention). References #7277, #7281. |
| 11b56c6 | healthchecks.go | No | Bug fix: health_port ignored. No explanation of why it was wrong. |
| 2ab043b | reverseproxy.go | **Yes** | Bug fix: query escape proxy protocol URLs. Explains h2 transport connection reuse issue. References #7529. |
| 72eaf25 | selectionpolicies.go, streaming.go | No | Chore: modernize linter (range syntax). |
| 9798f69 | httptransport.go | No | Bug fix: nil pointer in proxyWrapper. No why. |
| d7b21c6 | httptransport.go | **Yes** | Bug fix: TLS dialing with proxy protocol. Comments explain Go's address parsing breaks with "->" separator. |
| 95941a7 | healthchecks.go, selectionpolicies.go, streaming.go | No | Chore: nolint annotations. |
| 8a18acc | httptransport.go | No | Deps: bump go-proxyproto (affects import only). |

## Decisions Extracted from Git History

1. **sync.Map + atomic.Int64 for in-flight tracking** (commit 88616e8): Explicitly states "replacing the UsagePool with a dedicated package-level sync.Map and atomic.Int64 to track in-flight requests without global lock contention." Also mentions "lookup map in the admin API to fix a potential O(n^2) iteration." This is a genuine rejected alternative with rationale.

2. **NopCloser body wrapping** (commit a5e7c6e): Explains "cloneRequest does a shallow copy, so clonedReq.Body and r.Body share the same io.ReadCloser -- a dial-failure Close() would kill the original body for all subsequent retry attempts." References issues #6259 and #7546.

3. **Dynamic upstream tracking with timestamps** (commit db29860): Comment explains "dynamic upstreams are tracked in a separate map with last-seen timestamps so their health state persists across requests without being reference-counted (and thus discarded between requests)."

4. **URL query escaping for proxy protocol** (commit 2ab043b): Explains "h2 transport will use the address to determine if new connections are needed... without escaping, new connections are constantly created and closed until file descriptors are exhausted." References issue #7529.

5. **Custom DialTLSContext for proxy protocol** (commit d7b21c6): Explains the issue: "ProxyProtocol is enabled, because req.URL.Host is modified to include client address info with '->' separator which breaks Go's address parsing."

## Decisions Marked "Unknown"

The following decisions are documented in the graph with "rationale: unknown" because no WHY was found in git history:

- Default try_interval of 250ms (only a code comment about CPU spinning)
- Rendezvous hashing over consistent hashing (only Wikipedia/blog references)
- xxhash choice (no history found)
- HMAC-SHA256 for cookies (no history found)
- Per-handler active vs global passive health state (only a code comment, no rationale)
- HTTP/3 must be exclusive (code comment: "add latency and complexity" but no deeper discussion)
- 32 max idle connections per host (references issue #2805 but no detail in this history)
- 3s default dial timeout (code comment only)

## Information Sources

| Source | Decision Count | Quality |
|---|---|---|
| Commit messages with multi-line bodies | 5 decisions | High -- explicit alternatives and rationale |
| Code comments | 8+ observations | Medium -- describes what/how but rarely why |
| Issue/PR references in commits | 6 references | Not followed (would need GitHub API) |
| Git diffs alone | 0 decisions | Low -- shows what changed but not why |

## Observations

1. **Caddy has excellent commit messages for non-trivial changes.** Commits that are bug fixes or features tend to include detailed explanations in the body, often referencing issues and explaining the root cause.
2. **Chore/lint commits have no useful WHY.** 3 of 11 commits were chores (linter, deps) with no architectural information.
3. **Most deep design rationale lives in code comments, not git history.** The choice of rendezvous hashing, reservoir sampling, and many other algorithmic decisions are documented in code comments with references to external resources, but git history doesn't capture the original decision moment.
4. **Only 11 commits were available** for these files. The repo may have been cloned with limited depth, or these files may have been relatively stable. More history would likely yield more WHY information, especially from the original implementation commits.
5. **36% of commits had useful multi-line messages** -- this meets the methodology's minimum threshold of 30%.
