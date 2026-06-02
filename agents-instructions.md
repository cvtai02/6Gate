# Agent Instructions

Use this file as the root instruction index for AI agents working in 6Gate.

## Required Structure

- Keep backend code in `app/`.
- Keep frontend code in `ui/`.
- Keep portable TypeScript clients in `api-clients/`.
- Keep local automation and smoke tests in `api-mcp-server/`.
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

- Runtime settings are stored in the JSON file configured by `env.settingsPath`.
- Do not store runtime settings in `.env` files or committed JSON files.
- If settings are changed through the UI, the app may need a restart before all changes take effect.

## Documentation

- Update relevant `index.md` files when folder structure, APIs, use cases, DTOs, module boundaries, infrastructure adapters, or shared kernel concepts change.
- Update relevant `rules.md` files when implementation rules change.
- Create backend-to-UI handoffs for API contract changes.
