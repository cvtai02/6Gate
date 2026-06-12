# Backend Rules

- Controllers call use cases only.
- Use cases may access Drizzle ORM directly.
- No repository layer.
- Shared enums, policies, guards, auth helpers, and security helpers belong in `src/core/`.
- Database, file, job, OAuth, and provider integrations belong in `src/infrastructure/`.
- Infrastructure code must be replaceable and must not contain business logic.
- Bootstrap settings live in `app/.env`; runtime settings live in the database.
- `.env` may contain only bootstrap settings: `SYSTEM_SECRET`, `ENCRYPTION_KEY`, and `DATABASE_CONNECTION_STRING`.
- Protected API endpoints authenticate with `Authorization: Bearer <token>` only.
- Module request/response DTOs must live in each module's `dtos/` folder and be reused by controllers and use cases.
- Each use case action must be in its own `*.usecase.ts` file. Group many use cases into `commands/` and `queries/` subfolders.

## Entity and Aggregate Rules

- Entity classes must define and protect the constraints of that entity.
- Aggregates must define and protect constraints involving relationships between multiple entities.
- When the ORM returns plain objects instead of entity classes, validate invariants in use cases and shared value objects instead of adding a mapping layer over the ORM.
