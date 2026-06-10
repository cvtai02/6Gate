# App Backend

NestJS backend application.

## Layers

- `core/` - entities, enums, constants, policies, contracts, guards, abstractions.
- `infrastructure/` - SQLite, local storage, provider adapters, OAuth clients.
- `modules/` - API modules with `api/`, `usecases/`, and `dtos/` folders.

## Bootstrap vs Runtime Config

- `app/.env` holds bootstrap settings: `SYSTEM_SECRET` and any other startup-only values.
- All runtime settings (port, storage config, external service URLs, etc.) are stored in the database `settings` table and managed via `modules/settings`.

## CORS

All origins, methods, and headers are allowed. Configured explicitly in `main.ts`.

## Admin Auth

Protected endpoints require either:
- `Authorization: Bearer <jwt>` — session JWT signed with `SYSTEM_SECRET` (issued by `POST /api/auth/login`)
- `x-system-secret: <secret>` — raw secret for direct API clients

Sensitive settings (e.g. `storageAccessToken`) are encrypted at rest using AES-256-GCM keyed from `SYSTEM_SECRET`. See `lib/crypto.ts`.
