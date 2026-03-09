# Lazy Evaluation

The Request class uses lazy properties for expensive operations:

- `user` / `auth` — triggers `_authenticate()` on first access
- `data` — triggers `_load_data_and_files()` on first access
- `stream` — triggers `_load_stream()` on first access

## Mechanism

Uses an `Empty` sentinel class (not `None`) to distinguish "not yet computed" from "computed to None." The `_hasattr()` helper checks whether an attribute is still `Empty`.

## Constraint

All lazy property access must be wrapped in `wrap_attributeerrors()` context manager. This re-raises `AttributeError` as `WrappedAttributeError` to prevent Python's descriptor protocol from silently swallowing errors thrown inside `@property` getters.

## Exception: Eager Forcing

Although Request supports lazy authentication, APIView's `perform_authentication()` forces it eagerly by accessing `request.user`. This ensures authentication errors occur at a predictable point in the request lifecycle (during `initial()`), before handler execution. Views can override `perform_authentication()` to restore lazy behavior.
