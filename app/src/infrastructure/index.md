# Infrastructure Layer

Infrastructure owns database configuration, migrations, file helpers, job services, OAuth clients, and provider adapters.

## Folders

- `auth/` - OAuth service integration.
- `config/` - bootstrap environment defaults.
- `db/` - Drizzle schema, connection, and migrations. Drizzle is the database adapter.
- `files/` - file path helpers.
- `jobs/` - job runner and log persistence services.
- `providers/` - external social/provider adapters.
