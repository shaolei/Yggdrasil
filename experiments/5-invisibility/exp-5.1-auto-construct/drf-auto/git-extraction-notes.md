# Git Extraction Notes — Django REST Framework

## Repository Stats

- **Repository**: encode/django-rest-framework
- **Total commits in repo**: 8,975
- **Commits touching target files**: 400 unique commits across 5 files
  - `views.py`: 135 commits
  - `request.py`: 107 commits
  - `authentication.py`: 86 commits
  - `permissions.py`: 73 commits
  - `throttling.py`: 38 commits

## Commit Message Quality

- **Commits with meaningful body (>20 chars)**: 107/400 (26.8%)
- **Commits with WHY-like keywords**: 72/400 (18%)
- **Commit culture**: Mixed. Many single-line commits ("Typo", "Cleanup", "Pep8"), but significant commits include PR numbers and descriptive bodies. Project uses squash-merge for PRs.

## WHY Information Extracted from Git History

### Decisions with explicit rationale (from commits/comments)

1. **CSRF exemption in `as_view()` not `dispatch()`** — Code comment: "to prevent accidental removal of this exemption in cases where dispatch needs to be overridden." Commit `fc0be55d`.

2. **OR permission semantics change** — Commit `4aea8dd6` (#7522): "The original semantic of OR is defined as: the request pass either of the two has_permission() checks. But when checking object permissions, the original implementation only checks has_object_permission without verifying has_permission first."

3. **Permissions must return boolean** — Commit `6f2c0dbf`: "`x and y` actually returns object y when both are true."

4. **Vary header patching** — Commit `9ebd5a29`: "Previously, any existing vary headers would simply be wiped out by DRF."

5. **Reorder initial() pipeline** — Commit `03270431`: "Determining the version and performing content negotiation should be done before ensuring the permission of the request. The reason is that these information might be needed for the permission."

6. **Transaction rollback on error** — Commit `c2d24172`: "Tell default error handler to doom the transaction on error."

7. **Use overridden settings exception handler** — Commit `c2ee1b30`: "Instead of using the api_settings exception handler, we use the overridden settings attribute to find the correct handler."

8. **OAuth removed to separate package** — Commit `baa518cd`: "Moved OAuth support out of DRF and into a separate package, per #1767."

9. **List over deque reverted** — Commit `72c155d8` reverted `ebcb8d53`, but no rationale provided.

10. **All throttles checked, not short-circuited** — Commit `afb67843` (#6711).

11. **WrappedAttributeError** — Commit `c63e35cb` (#5600): "Fix AttributeError hiding on request authenticators."

12. **RuntimeError over AssertionError for queryset guard** — Commit `bdeb2894`: refs #3180.

13. **Django 5.1 LoginRequiredMiddleware exemption** — Code comment: "Users should set DEFAULT_PERMISSION_CLASSES to 'rest_framework.permissions.IsAuthenticated' instead."

### Decisions marked "rationale: unknown"

1. Content negotiator caching on view instance (unlike other per-request policies)
2. SessionAuthentication skipping CSRF for unauthenticated requests
3. BasicAuthentication Latin-1 fallback
4. List vs deque for throttle history (revert happened but no explanation)
5. Cache-backed throttling (obvious in hindsight but not stated in commits)

## What Was Useful vs Not

### Most useful commit types
- Bug fix commits with "Fixes #NNN" — often explain the problem being solved
- Feature commits with PR descriptions — explain the design
- Revert commits — signal that a decision was reconsidered
- Code comments (in source, not commits) — often contain the most valuable "why" information

### Least useful commit types
- "Cleanup", "Typo", "Pep8", "Linting" — no semantic value
- Merge commits — no information beyond the merge
- "Version X.Y.Z" — no architectural information
- Single-word subject lines — no context

### Key observation
The richest source of WHY information was **code comments**, not commit messages. DRF has excellent inline comments explaining design decisions (CSRF exemption rationale, authentication laziness, Empty sentinel pattern). Commit messages tended to describe WHAT changed, while code comments explained WHY.

## Percentage of Commits with Useful Multi-line Messages

26.8% of commits had bodies longer than 20 characters. However, many of those were just co-author lines or PR commit lists. Approximately 15-18% contained genuinely useful design context.

## Limitations

1. The repository was initially a shallow clone (50 commits). Had to run `git fetch --unshallow` to get full history.
2. PR descriptions and review comments were not extracted (would require GitHub API). These likely contain significant additional rationale.
3. The `--follow` flag cannot be used with multiple files, so history for renamed files may be incomplete.
4. Squash-merged PRs lose the individual commit narrative — only the final squashed message remains.
