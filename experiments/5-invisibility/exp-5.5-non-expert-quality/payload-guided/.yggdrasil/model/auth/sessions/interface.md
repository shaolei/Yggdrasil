# Sessions Interface

## addSessionToUser

```typescript
addSessionToUser({ collectionConfig, payload, req, user }): Promise<{ sid?: string }>
```

Creates a new session (UUID) with expiry based on `tokenExpiration`. Cleans up expired sessions. Sets `user.updatedAt = null`. Updates user in database. Sets `user.collection` and `user._strategy = 'local-jwt'`. Returns the session ID if sessions are enabled, undefined otherwise.

## revokeSession

```typescript
revokeSession({ collectionConfig, payload, req, sid, user }): Promise<void>
```

Removes a specific session by ID from the user's sessions array.

## removeExpiredSessions

```typescript
removeExpiredSessions(sessions: UserSession[]): UserSession[]
```

Pure filter function — returns sessions whose `expiresAt` is in the future.
