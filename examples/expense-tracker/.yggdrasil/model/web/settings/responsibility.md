# Settings

User account and subscription management pages.

## Responsible for

- Settings page: profile display (email, plan badge), password change form (current + new + confirm)
- Subscription page: current plan display, upgrade button for free-plan users, calls loadUser() after upgrade to refresh auth context

## Not responsible for

- Authentication flow (delegated to web/auth)
- Payment processing (upgrade is mock)
