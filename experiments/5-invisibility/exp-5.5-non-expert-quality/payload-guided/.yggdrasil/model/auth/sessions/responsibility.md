# Sessions

## Responsibility

Manages user session lifecycle: creating sessions, revoking sessions, and removing expired sessions. Sessions are stored as an array on the user document.

## Not Responsible For

- Session validation during authentication (that's in the JWT strategy)
- Deciding when to create/revoke sessions (that's in the operations)
