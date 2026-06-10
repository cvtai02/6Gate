# Groups Module

Owns publish groups, their destination membership, upload batch creation, grouped upload history, and per-group queued uploads.

## Upload APIs

### Immediate upload
`POST /api/groups/:id/upload` — download from 7router and immediately create post jobs for all destinations.

**Body:**
```json
{
  "absolutePath": "CloudflareR2/account/bucket/folder/video.mp4",
  "title": "optional title",
  "caption": "optional caption",
  "privacy": "public"
}
```

### Queue an upload
`POST /api/groups/:id/queue` — enqueue a 7router absolute path; dispatched at the group's daily upload time.

**Body:**
```json
{
  "absolutePath": "CloudflareR2/account/bucket/folder/video.mp4",
  "title": "optional title",
  "caption": "optional caption",
  "privacy": "public"
}
```

`absolutePath` must be a 7router absolute path in the format `Provider/account/bucket[/folder.../file]`.

## Queue API

- `GET  /api/groups/:id/queue` — list persisted queue items (returns `absolutePath` per item).
- `DELETE /api/groups/:id/queue/:itemId` — remove an item.
- `GET  /api/groups/:id/queue-settings` — return the daily upload time(s).
- `PATCH /api/groups/:id/queue-settings` — update `uploadTimeInDay` in local `HH:mm` format.

The scheduler dispatches the first `pending` item for each group when its daily time is reached, then calls `CreateGroupUploadJobsUseCase` to create normal upload jobs for all destinations in that group.
