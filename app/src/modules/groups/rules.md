# Groups Rules

- Controllers may call group use cases only.
- Use cases access Drizzle directly and may delegate job creation to the jobs service.
- `absolutePath` must always be a 7router absolute path: `Provider/account/bucket[/folder.../file]`.
- Group uploads create one post job per destination and share an `uploadBatchId`.
- Queue items must persist in `group_upload_queue` (`video_path` column stores the 7router absolute path).
- Queue settings must persist in `group_upload_settings`.
- `uploadTimeInDay` must use valid local `HH:mm`.
- Scheduled queue dispatch must create normal group upload jobs through `CreateGroupUploadJobsUseCase`.
