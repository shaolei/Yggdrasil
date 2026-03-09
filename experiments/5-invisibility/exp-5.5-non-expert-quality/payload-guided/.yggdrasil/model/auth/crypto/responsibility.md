# Crypto

## Responsibility

AES-256-CTR encryption and decryption. Used for encrypting sensitive tokens (e.g., password reset tokens). Uses `this.secret` bound at call site.

## Note

Contains `@ts-expect-error` comments — legacy code from before strict TypeScript config. The `this.secret` binding pattern is non-standard.
