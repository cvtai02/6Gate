# Backend Rules

- Controllers call use cases only.
- Use cases may access Drizzle ORM directly.
- No repository layer.
- Infrastructure code must be replaceable and must not contain business logic.
- Bootstrap settings live in `app/.env`; runtime settings live in the database `settings` table.
- Module request/response DTOs must live in each module's `dtos/` folder and be reused by controllers and use cases.
- Each use case action must be in its own `*.usecase.ts` file. Group many use cases into `commands/` and `queries/` subfolders.