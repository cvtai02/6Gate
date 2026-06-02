# Modules

NestJS API modules and use cases.

Each module should use this layout:

- `api/` - controllers and API boundary code.
- `usecases/commands/` - state-changing business actions.
- `usecases/queries/` - read-only business actions.
- `usecases/shared/` - helpers used by multiple use cases in the module.
- `dtos/` - request and response DTOs shared by controllers and use cases.

Small modules with only one or two use cases may keep those files directly under `usecases/`. Each use case file should be named `*.usecase.ts` and expose one action class with an `execute` method.

Current modules include accounts, destinations, groups, health, jobs, oauth, providers, settings, and uploads.
