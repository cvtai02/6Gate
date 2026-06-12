# Agent Instructions

Before making changes, read `index.md` and `rules.md`.

Follow the root project rules plus the nearest `index.md` and `rules.md` files for the area you edit.

Key requirements:

- Keep backend code in `app/` and frontend code in `ui/`.
- Keep shared backend concepts in `app/src/core/`.
- Keep external integrations and adapters in `app/src/infrastructure/`.
- Do not add repository layers over Drizzle.
- Use login-issued bearer tokens for protected API calls.
- Do not add cookie sessions, token query strings, or raw system-secret API bypasses.
- Create handoffs for backend/UI contract changes according to `handoffs/rules.md`.
- Run a smoke test before finishing a change.
