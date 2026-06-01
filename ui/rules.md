# UI Rules

- UI consumes backend APIs through `api-clients/`.
- UI must not import backend infrastructure or database modules.
- `/api/*` calls are proxied to the Nest backend during development.

