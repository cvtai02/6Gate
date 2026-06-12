# Handoff: Bearer Auth Only

Status: Pending
Direction: Backend to UI
Created: 2026-06-12
Owner: Codex

## Summary

Protected backend endpoints now accept only login-issued bearer tokens.

## Context

The project rules require protected API authentication via `Authorization: Bearer <token>` and disallow raw secret bypasses, cookie sessions, and token query strings.

## Contract / Requirement

Clients must call `POST /api/auth/login` with the system secret, store the returned `token`, and send it on protected endpoint requests as:

```http
Authorization: Bearer <token>
```

The previous `x-system-secret` direct API bypass is no longer supported.

## Files Changed or Expected

- `app/src/core/guards/system-token.guard.ts`
- `ui/src/lib/auth.ts`
- `ui/src/proxy.ts`
- `ui/next.config.ts`

## Acceptance Criteria

- [ ] UI login stores the returned token.
- [ ] UI API requests send `Authorization: Bearer <token>`.
- [ ] Protected API requests without a valid bearer token return 401.
- [ ] Smoke test passes.

## Notes

The current UI auth fetch interceptor already sends bearer tokens for same-origin `/api/*` calls.
