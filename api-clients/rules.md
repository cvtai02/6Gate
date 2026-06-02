# API Client Rules

- DTOs are defined once here and shared by backend use cases and UI clients.
- Keep functions browser-safe and fetch-based.
- Do not import backend infrastructure.
- Update `src/types.ts`, `src/client.ts`, and the package tarball whenever API contracts change.
