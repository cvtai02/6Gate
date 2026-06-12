# Core Rules

- Core contains domain concepts and contracts only.
- Core does not import infrastructure implementations.
- Core may contain enums, constants, policies, shared value objects, auth helpers, guards, infrastructure contracts, and cross-module domain concepts.
- Entity classes must protect their own constraints.
- Aggregates must protect constraints involving relationships between multiple entities.
