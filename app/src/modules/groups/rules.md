# Groups Rules

- Controllers may call group use cases only.
- Use cases access Drizzle directly and may delegate job creation to the jobs service.
- Group uploads create one post job per destination and share an `uploadBatchId`.
- Queue items must persist in `group_upload_queue` (`video_path` column stores the video URL).
- Queue settings must persist in `group_upload_settings`.
- `uploadTimeInDay` must use valid local `HH:mm`.
- Scheduled queue dispatch must create normal group upload jobs through `CreateGroupUploadJobsUseCase`.
