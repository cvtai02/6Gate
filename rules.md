# 6Gate Rules

This project follows the root structure and implementation rules in `agents-instructions.md`.

- `app/` is backend-only and owns APIs, use cases, runtime lifecycle, settings, and background jobs.
- `ui/` is frontend-only and consumes APIs through `api-clients/`.
- Runtime settings are stored in the JSON file configured by `env.settingsPath`, not `.env` files or committed JSON files.
- API controllers call use cases only.
- Use cases may access Drizzle ORM directly; no repository layer.
- Infrastructure implements replaceable adapters and contains no business logic.
- Major layers and modules must keep `index.md` and `rules.md`.
- App modules use `api/`, `usecases/`, and `dtos/` folders.
