# Project Rules

## Structure

- `app/` contains the NestJS backend.
- `ui/` contains the Next.js admin UI.
- `handoffs/` contains temporary backend/UI coordination documents.
- `index.md`, `rules.md`, `AGENTS.md`, and `CLAUDE.md` must exist at the project root.
- Agents must read `index.md` and `rules.md` before making changes.

## Settings

- `.env` files may contain only bootstrap settings.
- Backend bootstrap settings: `SYSTEM_SECRET`, `ENCRYPTION_KEY`, and `DATABASE_CONNECTION_STRING`.
- UI bootstrap settings: `API_BASE_URL`.
- Runtime settings belong in the database. Secret runtime settings must be encrypted with `ENCRYPTION_KEY`.

## Auth And CORS

- The admin UI must log in with the system secret.
- Protected API endpoints must authenticate with `Authorization: Bearer <token>`.
- Do not use cookie sessions or token query strings.
- CORS must allow all origins, methods, and headers.

## Backend Architecture

- Do not add repositories or custom abstractions over the ORM.
- Use cases may depend directly on the Drizzle ORM context.
- Shared enums, constants, policies, guards, value objects, and contracts belong in `app/src/core/`.
- Database, storage, files, jobs, OAuth, and external provider integrations belong in `app/src/infrastructure/`.
- Non-ORM infrastructure should implement contracts from the core/shared kernel when a replaceable boundary is needed.

## Modules

- Each backend module should use `api/`, `usecases/`, and `dtos/` folders.
- Each controller/API, use case, and DTO belongs in its own file.
- DTOs are shared by controllers and use cases.
- Group many use cases under descriptive subfolders such as `commands/` and `queries/`.

## Entities And Aggregates

- Entity classes must define and protect the constraints of that entity.
- Aggregates must define and protect constraints involving relationships between multiple entities.
- When the ORM returns plain objects instead of entity classes, validate invariants in use cases and shared value objects rather than introducing a mapping layer over the ORM.

## API, Migrations, And Tests

- APIs must return one consistent JSON error shape across endpoints.
- Schema changes must go through ORM migrations committed with the code that needs them.
- A passing smoke test is required for every change.
- API contract changes require a backend-to-UI handoff unless the UI change ships in the same change set.
