# Groups Module

Owns publish groups, their destination membership, upload batch creation, grouped upload history, and per-group queued uploads.

## Queue API

- `GET /api/groups/:id/queue` lists persisted queue items.
- `POST /api/groups/:id/queue` enqueues an absolute video path for the group.
- `DELETE /api/groups/:id/queue/:itemId` removes an item.
- `GET /api/groups/:id/queue-settings` returns the daily upload time.
- `PATCH /api/groups/:id/queue-settings` updates `uploadTimeInDay` in local `HH:mm` format.

The scheduler dispatches the first pending item for each group when its daily time is reached, then creates normal upload jobs for all destinations in that group.
