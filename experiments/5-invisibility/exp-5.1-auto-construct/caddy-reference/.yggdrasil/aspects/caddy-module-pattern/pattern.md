# Caddy Module Pattern

## What

Every component in the reverse proxy follows Caddy's module registration and lifecycle protocol:

1. **Registration**: Each module type has an `init()` function that calls `caddy.RegisterModule()` with a zero-value instance.
2. **Identity**: Each module implements `CaddyModule()` returning `caddy.ModuleInfo` with a namespaced ID (e.g., `http.reverse_proxy.selection_policies.random`) and a constructor function.
3. **Provisioning**: Modules implement `caddy.Provisioner` via `Provision(caddy.Context) error`. This is where configuration is validated, defaults are set, sub-modules are loaded, and runtime state is initialized.
4. **Validation**: Optional `Validate() error` for post-provision validation.
5. **Cleanup**: Optional `caddy.CleanerUpper` via `Cleanup() error` for resource release.
6. **Interface guards**: Compile-time interface satisfaction checks using `var _ Interface = (*Type)(nil)`.

## Why

This pattern enables Caddy's plugin architecture where components are swappable via JSON configuration. The module namespace (e.g., `http.reverse_proxy.transport.http`) determines where in the config hierarchy a module can be used. This makes the reverse proxy extensible: transports, selection policies, upstream sources, and circuit breakers can all be replaced with custom implementations.
