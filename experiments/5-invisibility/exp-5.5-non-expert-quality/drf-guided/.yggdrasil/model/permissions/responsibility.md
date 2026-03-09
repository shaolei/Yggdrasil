# Permissions

Provides pluggable permission policies that determine whether a request should be allowed or denied.

## Responsibilities

- Defining the `BasePermission` interface (`has_permission`, `has_object_permission`)
- Providing built-in permission classes: AllowAny, IsAuthenticated, IsAdminUser, IsAuthenticatedOrReadOnly
- Providing Django model-level permissions: DjangoModelPermissions, DjangoObjectPermissions
- Supporting boolean composition of permissions via AND (`&`), OR (`|`), NOT (`~`) operators
- Distinguishing view-level permissions (`has_permission`) from object-level permissions (`has_object_permission`)

## NOT Responsible For

- Enforcing permissions (done by APIView's `check_permissions` and `check_object_permissions`)
- Authentication (relies on `request.user` being set)
- Determining 401 vs 403 response codes (done by APIView's `permission_denied` method)
