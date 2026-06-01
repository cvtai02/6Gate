# Jobs Rules

- Controllers call job use cases only.
- The job runner starts through Nest module lifecycle.
- Scheduling is enforced by the runner: future `scheduledAt` jobs remain queued.
- SSE endpoints stream logs and status only; mutations use normal HTTP routes.
