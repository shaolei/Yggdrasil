# Caddy Module Pattern

Every component in the reverse proxy subsystem is a Caddy module. This means:

1. **Registration**: Each module type has an `init()` function calling `caddy.RegisterModule()` with an instance of the type.
2. **Identity**: Each type implements `CaddyModule() caddy.ModuleInfo` returning a unique module ID (e.g., `http.reverse_proxy.selection_policies.random`).
3. **Provisioning**: Types implement `Provision(ctx caddy.Context) error` for setup — loading sub-modules, setting defaults, creating internal state.
4. **Validation**: Optional `Validate() error` for checking config correctness after provisioning.
5. **Cleanup**: Optional `Cleanup() error` (implements `caddy.CleanerUpper`) for releasing resources.
6. **Interface guards**: Compile-time checks via `var _ SomeInterface = (*Type)(nil)` at the bottom of each file.
7. **JSON configuration**: All config fields use JSON struct tags; sub-modules use `json.RawMessage` with `caddy:` namespace annotations for dynamic loading.
8. **Caddyfile support**: Most modules implement `caddyfile.Unmarshaler` for Caddyfile config parsing.

This pattern enables the plugin architecture where components are interchangeable and loaded dynamically from JSON configuration.
