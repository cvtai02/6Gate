# Handoff: File Upload Use Cases

Status: Pending
Direction: Backend to UI
Created: 2026-06-12
Owner: Codex

## Summary

Two multipart file-upload group endpoints were added.

## Context

The existing group upload flows use path strings: one immediate 7router path flow and one queued 7router path flow. New use cases need clients to upload file bytes directly instead of providing a directory/path.

## Contract / Requirement

### Immediate File Upload

`POST /api/groups/:id/upload-file`

Content type: `multipart/form-data`

Fields:

- `file` - required video file.
- `title` - optional string.
- `caption` - optional string.
- `privacy` - optional `public`, `unlisted`, or `private`.

Response matches `POST /api/groups/:id/upload`: `{ groupId, uploadBatchId, jobs }`.

### Queued File Upload

`POST /api/groups/:id/queue-file`

Content type: `multipart/form-data`

Fields:

- `file` - required video file.
- `title` - optional string.
- `caption` - optional string.
- `privacy` - optional `public`, `unlisted`, or `private`.

Response matches `POST /api/groups/:id/queue`, with `absolutePath` set to the backend-stored upload file path.

## Files Changed or Expected

- `app/src/modules/groups/api/groups.controller.ts`
- `app/src/modules/groups/usecases/commands/create-group-upload-file-jobs.usecase.ts`
- `app/src/modules/groups/usecases/commands/enqueue-group-upload-file.usecase.ts`
- `ui/src/app/usecases/page.tsx`
- `ui/vendor/sixgate-api-client/src/client.ts`

## Acceptance Criteria

- [ ] Immediate multipart upload creates post jobs.
- [ ] Queued multipart upload creates a pending queue item.
- [ ] Scheduler dispatches queued uploaded files without calling 7router.
- [ ] Smoke test passes.

## Notes

Uploaded files are stored in the backend upload directory and must remain available until jobs finish or queued items dispatch.
