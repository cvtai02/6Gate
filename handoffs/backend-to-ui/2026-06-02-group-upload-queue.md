# Handoff: Group Upload Queue

Status: Pending
Direction: Backend to UI
Created: 2026-06-02
Owner: Backend

## Summary

Groups now have a persisted upload queue and a daily upload-time setting. The backend scheduler dispatches the first pending queued video for each group when the group's local `uploadTimeInDay` is reached.

## Context

The UI needs controls to view a group's queue, add absolute video paths, delete queued items, and configure the group's daily upload time.

## Contract / Requirement

New API routes:

- `GET /api/groups/:id/queue`
- `POST /api/groups/:id/queue`
- `DELETE /api/groups/:id/queue/:itemId`
- `GET /api/groups/:id/queue-settings`
- `PATCH /api/groups/:id/queue-settings`

The same routes are available under `/api/combos/:id/...`.

Queue enqueue request:

```json
{
  "videoPath": "C:\\absolute\\path\\video.mp4",
  "title": "Optional title",
  "caption": "Optional caption",
  "privacy": "private",
  "scheduledAt": "Optional provider scheduled publish time"
}
```

Queue settings request:

```json
{
  "uploadTimeInDay": "09:00"
}
```

`uploadTimeInDay` must be valid local `HH:mm`.

## Files Changed or Expected

- `app/src/modules/groups/api/groups.controller.ts`
- `app/src/modules/groups/usecases/groups.usecases.ts`
- `app/src/modules/groups/dtos/*queue*.ts`
- `app/src/server/db/schema.ts`
- `app/src/server/db/migrate.ts`
- `api-clients/src/types.ts`
- `api-clients/src/client.ts`

## Acceptance Criteria

- [ ] UI can list queued group uploads.
- [ ] UI can enqueue an absolute path for a group.
- [ ] UI can remove queued items.
- [ ] UI can view and update `uploadTimeInDay`.
- [ ] API client is updated.
- [ ] Relevant `index.md` files are updated.
- [ ] Relevant `rules.md` files are updated, if needed.
- [ ] Smoke test passes, if applicable.

## Notes

The scheduler dispatches at most one pending item per group per local calendar day. Once dispatched, a queue item is marked `Dispatched` and the normal post job runner handles provider uploads.
