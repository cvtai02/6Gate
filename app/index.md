# App Backend

NestJS backend application.

## Layers

- `core/` - entities, enums, constants, policies, contracts, abstractions.
- `infrastructure/` - SQLite, local storage, provider adapters, OAuth clients.
- `modules/` - API modules with `api/`, `usecases/`, and `dtos/` folders.

Runtime settings are managed by `modules/settings` and persisted to the JSON file at `env.settingsPath`.
