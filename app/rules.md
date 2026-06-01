# Backend Rules

- Controllers call use cases only.
- Use cases may access Drizzle ORM directly.
- No repository layer.
- Infrastructure code must be replaceable and must not contain business logic.
- Runtime settings must come from the settings table with safe bootstrap defaults.

