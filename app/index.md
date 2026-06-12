# App Backend

NestJS backend application.

## Layers

- `core/` - entities, enums, constants, policies, contracts, guards, auth helpers, and shared abstractions.
- `infrastructure/` - database configuration, storage helpers, provider adapters, OAuth clients, and job services.
- `modules/` - API modules with `api/`, `usecases/`, and `dtos/` folders.

## Bootstrap vs Runtime Config

- `app/.env` holds bootstrap settings: `SYSTEM_SECRET`, `ENCRYPTION_KEY`, and `DATABASE_CONNECTION_STRING`.
- All runtime settings are stored in the database and managed through backend use cases and the admin UI.

## CORS

All origins, methods, and headers are allowed. Configured explicitly in `main.ts`.

## Admin Auth

Protected endpoints require `Authorization: Bearer <jwt>`. Tokens are issued by `POST /api/auth/login` after the admin submits the system secret.

Sensitive settings (e.g. `storageAccessToken`) are encrypted at rest using AES-256-GCM keyed from `ENCRYPTION_KEY`. See `core/security/crypto.ts`.
