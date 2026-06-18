# Groups Module

Owns publish groups, their destination membership, upload batch creation, grouped upload history, and per-group queued uploads.

## Upload APIs

Video input is via URL (`videoUrl` JSON field) — Telegram video link, CDN URL, or any publicly accessible video URL.

### Immediate upload
`POST /api/groups/:id/upload` — JSON body with `videoUrl`; downloads and immediately creates post jobs.

**JSON body:**
```json
{
  "videoUrl": "https://cdn.example.com/video.mp4",
  "title": "optional title",
  "caption": "optional caption",
  "privacy": "public"
}
```

### Queue an upload
`POST /api/groups/:id/queue` — JSON body with `videoUrl`; enqueued for scheduled dispatch.

## Queue API

- `GET  /api/groups/:id/queue` — list persisted queue items.
- `DELETE /api/groups/:id/queue/:itemId` — remove an item.
- `GET  /api/groups/:id/queue-settings` — return the daily upload time(s).
- `PATCH /api/groups/:id/queue-settings` — update `uploadTimeInDay` in local `HH:mm` format.

The scheduler dispatches the first `pending` item for each group when its daily time is reached, then calls `CreateGroupUploadJobsUseCase` to create normal upload jobs for all destinations in that group.
