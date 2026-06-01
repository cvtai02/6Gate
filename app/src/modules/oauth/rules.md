# OAuth Rules

- OAuth controllers call OAuth use cases only.
- Provider-specific OAuth behavior stays in provider adapters.
- Callback routes redirect to UI pages with the same query flags used by the previous Next routes.
