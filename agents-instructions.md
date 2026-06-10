# Agent Instructions

Use this file as the root instruction index for AI agents working in 6Gate.

## Required Structure

- Keep backend code in `app/`.
- Keep frontend code in `ui/`.
- Keep temporary coordination notes in `handoffs/`.
- Move completed handoffs to `handoffs/archive/`.

## Backend Rules

- Controllers live in module `api/` folders and call use cases only.
- Use cases live in module `usecases/` folders.
- Each use case action must be defined in its own `*.usecase.ts` file.
- Use `usecases/commands/` and `usecases/queries/` subfolders when a module has many use cases.
- DTOs live in module `dtos/` folders and are shared by controllers and use cases.
- Use cases may depend directly on the Drizzle ORM context.
- Do not add repository layers or abstractions over the ORM.
- Infrastructure implementations must remain adapter-based and replaceable.
- Shared enums, contracts, constants, policies, and cross-module concepts belong in `app/src/core/`.

## Settings

- Bootstrap settings (system token, database path) are stored in `app/.env`.
- All runtime settings are stored in the database `settings` table and managed by `modules/settings`.
- Do not store runtime settings in `.env` files or committed JSON files.
- Changed settings that affect startup (e.g., port) require an app restart to take effect.

## Admin UI

- Admin auth uses `SYSTEM_SECRET` from `app/.env`. UI users log in via `POST /api/auth/login` which sets a signed session cookie (JWT).
- The UI `proxy.ts` validates the session cookie and forwards it as `Authorization: Bearer <jwt>` to the backend.
- Direct API clients can authenticate with the `x-system-secret: <secret>` header instead.
- Both `app/.env` and `ui/.env.local` must have matching `SYSTEM_SECRET` values.

## CORS

- The backend allows all origins, methods, and headers.
- The UI Next.js proxy also sets permissive CORS headers for API routes.

## Documentation

- Update relevant `index.md` files when folder structure, APIs, use cases, DTOs, module boundaries, infrastructure adapters, or shared kernel concepts change.
- Update relevant `rules.md` files when implementation rules change.
- Create backend-to-UI handoffs for API contract changes.
