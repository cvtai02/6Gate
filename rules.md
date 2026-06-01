# 6Gate Rules

This project follows `AnyProjectRules.md`.

- `app/` is backend-only and owns APIs, use cases, runtime lifecycle, settings, and background jobs.
- `ui/` is frontend-only and consumes APIs through `api-clients/`.
- Runtime settings are stored in SQLite via the settings module, not `.env` files.
- API controllers call use cases only.
- Use cases may access Drizzle ORM directly; no repository layer.
- Infrastructure implements replaceable adapters and contains no business logic.
- Major layers and modules must keep `index.md` and `rules.md`.

