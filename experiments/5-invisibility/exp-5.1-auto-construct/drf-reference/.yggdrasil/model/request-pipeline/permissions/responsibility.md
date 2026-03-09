# Permissions

The permissions module is responsible for:

- Defining the `BasePermission` contract with two check levels: view-level (`has_permission`) and object-level (`has_object_permission`)
- Providing built-in permission classes: `AllowAny`, `IsAuthenticated`, `IsAdminUser`, `IsAuthenticatedOrReadOnly`, `DjangoModelPermissions`, `DjangoObjectPermissions`
- Enabling boolean composition of permissions via `&`, `|`, `~` operators
- Defining the `SAFE_METHODS` constant (`GET`, `HEAD`, `OPTIONS`) used by read-only permission checks

## Not responsible for

- Deciding when permissions are checked (that is APIView's `check_permissions` and `check_object_permissions`)
- Authentication (must happen before permission checking)
- Raising the actual HTTP response (permission classes return True/False; APIView translates to exceptions)
