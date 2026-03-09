# Permissions — Responsibility

## Identity

Provides pluggable permission policies that determine whether a request should be allowed or denied. Defines the `BasePermission` base class, the permission composition system (AND, OR, NOT operators), and ships several built-in permission classes for common access control patterns.

## Boundaries

**Responsible for:**
- Defining the permission interface (`has_permission`, `has_object_permission`)
- Composable permission logic via bitwise operators (`&`, `|`, `~`)
- Built-in permission classes: `AllowAny`, `IsAuthenticated`, `IsAdminUser`, `IsAuthenticatedOrReadOnly`
- Django model-level permissions (`DjangoModelPermissions`, `DjangoModelPermissionsOrAnonReadOnly`)
- Django object-level permissions (`DjangoObjectPermissions`)
- Defining `SAFE_METHODS` constant (`GET`, `HEAD`, `OPTIONS`)

**NOT responsible for:**
- Deciding when permission checks run (controlled by APIView)
- Authentication (relies on `request.user` being already resolved)
- Throttling / rate limiting
- Object retrieval (relies on view providing queryset)
