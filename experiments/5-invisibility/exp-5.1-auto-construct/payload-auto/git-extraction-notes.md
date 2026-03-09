# Git Extraction Notes — Payload CMS Auth

## Commit Analysis

### Total commits analyzed: 2

The repository was cloned with `--depth 50`, and only 2 commits in the available history touched the target area files.

### Commits with WHY information: 1 of 2 (50%)

| Commit | Subject | Has WHY? | Information extracted |
|--------|---------|----------|----------------------|
| 9f0c101 | fix: getFieldsToSign crashes when user missing group/tab fields (#15775) | YES | What: nullish coalescing fix. Why: user documents created before group/tab fields were added crash on login. How: `?? {}` default, consistent with afterRead/promise.ts pattern. |
| 929203c | chore: make test:e2e agent-friendly with --grep support and dev server reuse (#15755) | NO | Not related to auth — only touched test infrastructure that happened to be in the git log |

### Commit message quality

- 1 of 2 commits (50%) had useful multi-line messages with structured What/Why/How sections
- The useful commit had a clear GitHub issue reference (Fixes #15734)
- The other commit was a test infrastructure change, not auth-related

### Decisions extracted from git history

| Decision | Source | Confidence |
|----------|--------|------------|
| Nullish coalescing for missing group/tab data in getFieldsToSign | Commit 9f0c101 | High — explicit fix with rationale |
| Consistent with afterRead/promise.ts handling | Commit 9f0c101 | High — explicit reference to precedent |

### Decisions marked "unknown" (inferred from code only)

| Decision | What can be observed |
|----------|---------------------|
| PBKDF2 over bcrypt/scrypt | PBKDF2 is built into Node.js crypto; avoids native dependencies |
| jose over jsonwebtoken for JWT | jose works in edge runtimes; no native dependencies |
| Session updatedAt = null trick | Prevents session operations from changing user's visible modification timestamp |
| AES-256-CTR for encryption | Used for API key encryption; uses unusual `this.secret` binding |
| Synchronous field traversal with async collection | Entire field tree walked in one pass; async work batched |
| Where + fetchData=false = permission: true | Code TODO questions this for v4.0; currently optimistic |
| 20-second window for session revocation on lockout | Likely empirical; protects against parallel brute-force |
| incrementLoginAttempts bypasses request transaction | Code comment explains: cross-transaction visibility for parallel safety |
| API key dual SHA-1/SHA-256 check | Backward compatibility with pre-v3.46.0; code TODO marks for v4.0 removal |

### "Why NOT" information extracted

| Source | Content |
|--------|---------|
| Code TODO in getEntityPermissions.ts | "4.0: Investigate defaulting to false here... This seems more secure. Alternatively, we could set permission to a third state, like 'unknown'" |
| Code TODO in apiKey.ts | "V4 remove extra algorithm check" — SHA-1 kept only for backward compatibility |
| Code comment in populateFieldPermissions.ts | "We cannot include siblingData or blockData here... For consistency, it's thus better to never include the siblingData and blockData" |
| Code comment in incrementLoginAttempts.ts | Explains why `req` is not passed to DB calls — parallel transaction visibility |

### Limitations

1. **Shallow clone**: Only 2 commits available. A full clone would likely reveal hundreds of commits with much richer WHY information, PR descriptions, and design evolution.
2. **No PR descriptions**: `gh` CLI was not used (would require authentication and the shallow clone limits PR association anyway).
3. **No blame data**: Not extracted as the shallow history makes blame less useful.
4. **Most rationale inferred from code**: ~90% of documented decisions came from code analysis (comments, patterns, TODOs) rather than git history. This is expected with only 2 available commits.

### What percentage of commits had useful multi-line messages

50% (1 of 2). The useful commit had a well-structured What/Why/How format with issue reference. However, with only 2 commits available, this percentage is not statistically meaningful.

### Assessment

The shallow clone severely limited the git history signal. The vast majority of graph content was derived from:
1. Source code structure and patterns (~70%)
2. Code comments, including TODOs and inline explanations (~20%)
3. Git commit messages (~10%)

A full clone with PR descriptions would likely shift this distribution significantly toward git/PR-derived rationale.
