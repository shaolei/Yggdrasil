# Subscription Upgrade

## Business context

The upgrade path is the monetization mechanism. Free-plan limits create natural pressure to upgrade when users hit caps.

## Trigger

User navigates to subscription page and clicks "Upgrade to Pro."

## Goal

User's plan changes from free to pro, removing all limits.

## Participants

- **web/settings** — Subscription page with upgrade button
- **api/subscriptions** — Processes upgrade (mock, no payment)
- **api/db** — Updates subscription row

## Paths

### Happy path

1. User on free plan visits /settings/subscription.
2. Page shows current plan (Free) and upgrade button.
3. User clicks "Upgrade to Pro."
4. Web sends POST /subscriptions/upgrade.
5. API updates subscription plan to "pro" (idempotent — no-op if already pro).
6. Returns {ok: true, plan: "pro"}.
7. Web calls loadUser() to refresh auth context (fetches /users/me + /subscriptions/me).
8. Page refreshes, shows "You have Pro plan." Upgrade button disappears.

### Already pro

5a. User is already on pro plan.
5b. API returns same success response (idempotent).
5c. No visible change.

## Invariants

- Upgrade is idempotent — calling it multiple times has no side effects.
- No payment processing in this example — upgrade is instant and free.
- Plan change takes effect immediately for all subsequent limit checks.
