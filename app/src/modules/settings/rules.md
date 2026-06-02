# Settings Rules

- Persist runtime settings to the JSON file configured by `env.settingsPath`.
- Keep the JSON settings file ignored by git.
- Controllers must call settings use cases only.
- Add settings DTOs under `dtos/` when request or response contracts change.
