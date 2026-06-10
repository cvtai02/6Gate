# Core Layer

Entities, enums, constants, policies, contracts, guards, and abstractions shared across modules.

## Folders

- `guards/` - NestJS guards. `AuthGuard` protects mutating endpoints — validates JWT session (from UI) or `x-system-secret` header (direct API clients).
