Every data-modifying operation must be logged to the audit_log table.
Log entry format: { userId, action, entityType, entityId, oldState, newState, timestamp }.

Use AuditService.log() for all create, update, and delete operations.
Never log sensitive fields (passwords, tokens) in oldState/newState.
Audit log entries are append-only, never modified or deleted.
