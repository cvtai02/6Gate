# Module Rules

- Controllers live under `api/`.
- Use cases live under `usecases/`.
- Each use case must be defined in its own `*.usecase.ts` file.
- Use `usecases/commands/` for state-changing actions and `usecases/queries/` for read-only actions when a module has many files.
- Use `usecases/shared/` only for helpers shared by multiple use cases; shared helpers are not controller entry points.
- Controllers call use cases only.
- DTOs live under `dtos/` and are shared by controllers and use cases.
- Controllers must not import server infrastructure, ORM helpers, or provider adapters directly.
- Use cases may access Drizzle ORM directly; do not add repository wrappers.
