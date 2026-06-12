# Infrastructure Rules

- Infrastructure implements external integrations and replaceable adapters.
- Do not put business decisions in infrastructure.
- Do not add a repository layer over Drizzle; the ORM context is the database adapter.
- Provider-specific details must not leak into controllers.
