# UI Rules

- UI consumes backend APIs through `api-clients/`.
- UI must not import backend infrastructure or database modules.
- `/api/*` calls are proxied to the Nest backend during development.
- UI bootstrap settings are limited to `API_BASE_URL`.
- UI auth uses login-issued bearer tokens; do not add cookie sessions or token query strings.
