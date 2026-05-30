# 6Gate — Upload Video to a Group by Absolute Path

How a local app on the same machine can publish a video to every destination in a 6Gate group, then watch the publish jobs run to completion.

**Base URL:** `http://localhost:20129`
**CORS:** all `/api/*` endpoints return `Access-Control-Allow-Origin: *` — call from any origin (browser, Electron, native shell, child process).

---

## 1. Find the group ID

```http
GET /api/groups
```

```bash
curl http://localhost:20129/api/groups
```

Response:

```json
[
  {
    "id": "group_Ab3Xy7Zq",
    "name": "My Posting Group",
    "createdAt": "2026-05-29T10:00:00.000Z",
    "destinations": [
      { "destinationId": "dest_Yz9wQv1b", "name": "My YouTube Channel", "type": "youtube_channel", "providerType": "youtube" },
      { "destinationId": "dest_Mn3cBa8e", "name": "My TikTok Account",  "type": "tiktok_account",  "providerType": "tiktok"  },
      { "destinationId": "dest_Kp4dXl9f", "name": "My FB Page",         "type": "facebook_page",   "providerType": "meta"    }
    ]
  }
]
```

Grab the `id` of the group you want to publish to.

---

## 2. Submit the upload

```http
POST /api/groups/{groupId}/upload-by-path
Content-Type: application/json
```

```json
{
  "videoPath": "C:\\Users\\you\\Videos\\my-clip.mp4",
  "title": "My Video Title",
  "caption": "Optional caption / description",
  "privacy": "public",
  "contentType": "Video"
}
```

| Field         | Type   | Required | Notes                                                                  |
|---------------|--------|----------|------------------------------------------------------------------------|
| `videoPath`   | string | **yes**  | Absolute path on the machine running 6Gate. File must already exist.   |
| `title`       | string | no       | YouTube only — TikTok/FB use `caption` as the description.             |
| `caption`     | string | no       | Description / caption shown on the post.                               |
| `privacy`     | string | no       | `"public"` \| `"private"` \| `"unlisted"`. Default `"private"`.        |
| `contentType` | string | no       | `"Video"` (default) or `"Reel"`. `"Reel"` currently only affects Meta. |

### Success — `200 OK`

```json
{
  "groupId": "group_Ab3Xy7Zq",
  "jobs": [
    {
      "id": "job_Kp2mNx4qRs",
      "destinationId": "dest_Yz9wQv1b",
      "destinationName": "My YouTube Channel",
      "destinationIcon": "http://localhost:20129/icons/youtube.svg",
      "platform": "youtube",
      "jobDetailsLink": "http://localhost:20129/jobs/job_Kp2mNx4qRs",
      "jobEventsLink": "http://localhost:20129/api/post-jobs/job_Kp2mNx4qRs/events",
      "jobCancelLink": "http://localhost:20129/api/post-jobs/job_Kp2mNx4qRs/cancel"
    },
    {
      "id": "job_Rn7tLk0dFw",
      "destinationId": "dest_Mn3cBa8e",
      "destinationName": "My TikTok Account",
      "destinationIcon": "http://localhost:20129/icons/tiktok.svg",
      "platform": "tiktok",
      "jobDetailsLink": "http://localhost:20129/jobs/job_Rn7tLk0dFw",
      "jobEventsLink": "http://localhost:20129/api/post-jobs/job_Rn7tLk0dFw/events",
      "jobCancelLink": "http://localhost:20129/api/post-jobs/job_Rn7tLk0dFw/cancel"
    }
  ]
}
```

The endpoint **returns immediately** - one background job per destination is enqueued. Save the job IDs to track progress, open each `jobDetailsLink` in 6Gate, or subscribe to each `jobEventsLink`.

### Errors

| Status | Body                                                                                                    | When                                          |
|--------|---------------------------------------------------------------------------------------------------------|-----------------------------------------------|
| 400    | `{ "error": "videoPath is required" }`                                                                  | Missing field                                 |
| 400    | `{ "error": "File not found: <path>" }`                                                                 | Path doesn't exist on the 6Gate machine       |
| 400    | `{ "error": "Group has no destinations" }`                                                              | Group exists but no destinations linked       |
| 500    | `{ "error": "..." }`                                                                                    | DB / internal error                           |

### Notes on `videoPath`

- Must be **absolute** and **readable by the user running the 6Gate server**.
- On Windows, JSON requires escaping backslashes: `"C:\\Users\\you\\..."` or use forward slashes: `"C:/Users/you/..."`.
- The file is **not copied** — jobs reference it in place. Don't move or delete it until every job hits a terminal status.

---

## 3. Watch jobs run

Each enqueued job moves through a **state machine** as 6Gate uploads to the platform, the platform finishes processing, and the post becomes published. Status values:

| Status              | Meaning                                                                       | Terminal? |
|---------------------|-------------------------------------------------------------------------------|-----------|
| `Created`           | Queued, waiting to be picked up                                               | no        |
| `Initializing`      | Adapter is starting an upload session with the platform                       | no        |
| `Uploading`         | Bytes are being transferred                                                   | no        |
| `Finishing`         | Final commit / finalize call to the platform                                  | no        |
| `Processing`        | Platform is processing/transcoding/moderating the video                       | no        |
| `Published`         | Live on the platform (or accepted, awaiting moderation)                       | **yes**   |
| `Failed`            | Permanent error — `errorMessage` set                                          | **yes**   |
| `Retrying`          | Transient error, will retry automatically                                     | no        |
| `ReconnectRequired` | Auth expired or permission revoked — user must re-link the account in 6Gate  | no        |
| `Cancelled`         | User cancelled                                                                | **yes**   |

Use one SSE connection per job. **SSE is strongly preferred - push, not poll.**

### Option A - Subscribe to each job

```http
GET /api/post-jobs/{jobId}/events
Accept: text/event-stream
```

Each returned job includes a `jobEventsLink`. Open one `EventSource` per job. The server sends past logs first, then live events, then closes the connection once that job hits `Published`, `Failed`, or `Cancelled`.

```js
for (const job of jobs) {
  const es = new EventSource(job.jobEventsLink);

  es.addEventListener("log", (e) => {
    const { level, message } = JSON.parse(e.data);
    console.log(`[${job.id}] [${level}] ${message}`);
  });

  es.addEventListener("status", (e) => {
    const { status, providerPostUrl, errorMessage } = JSON.parse(e.data);
    if (status === "Published") {
      console.log(`[${job.id}] Live at:`, providerPostUrl);
      es.close();
    }
    if (status === "Failed") {
      console.error(`[${job.id}] Failed:`, errorMessage);
      es.close();
    }
    if (status === "Cancelled") {
      es.close();
    }
  });

  es.onerror = () => {
    // EventSource auto-reconnects on transient drops.
  };
}
```

### Option B - Polling (fallback)

If your environment can't handle SSE (some embedded webviews, queue workers, etc.), poll every 2-5 seconds:

```http
GET /api/post-jobs/{jobId}
```

```json
{
  "id": "job_Kp2mNx4qRs",
  "status": "Uploading",
  "platform": "meta",
  "videoPath": "C:\\Users\\you\\Videos\\clip.mp4",
  "title": "My Video Title",
  "providerPostId": null,
  "providerPostUrl": null,
  "errorMessage": null,
  "createdAt": "2026-05-29T10:01:00.000Z",
  "updatedAt": "2026-05-29T10:01:42.000Z",
  "logs": [
    { "level": "info", "message": "Phase 1/4: requesting upload session", "createdAt": "..." },
    { "level": "info", "message": "Uploaded 8,388,608/25,500,000 bytes (33%)", "createdAt": "..." }
  ]
}
```

`logs` is included on the detail endpoint so a single polling round trip gives you both status and progress lines. Stop polling when `status` is `Published`, `Failed`, or `Cancelled`.

### Retry a failed job

```http
POST /api/post-jobs/{jobId}/retry
```

Any non-success terminal job can be retried, including `Failed`, `Cancelled`, and `ReconnectRequired`. The job goes back to `Created` and the runner picks it up immediately.

### Cancel a queued or active job

```http
POST /api/post-jobs/{jobId}/cancel
```

The job moves to `Cancelled`, emits a terminal status event on its per-job stream, and will not be picked up by the runner if it was still queued.

---

## 4. End-to-end example (Node.js)

```js
import { EventSource } from "eventsource"; // npm i eventsource

const API = "http://localhost:20129";

// 1. Find a group
const groups = await fetch(`${API}/api/groups`).then((r) => r.json());
const group = groups.find((g) => g.name === "My Posting Group");

// 2. Submit upload
const { jobs } = await fetch(`${API}/api/groups/${group.id}/upload-by-path`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    videoPath: "C:\\Users\\you\\Videos\\clip.mp4",
    title: "My Upload",
    caption: "Description",
    privacy: "public",
  }),
}).then((r) => r.json());

console.log(`Enqueued ${jobs.length} jobs`);

// 3. Watch each job with its own stream
const remaining = new Set(jobs.map((j) => j.id));
const es = new EventSource(jobs[0].jobEventsLink);

es.addEventListener("status", (e) => {
  const { jobId, status, providerPostUrl, errorMessage } = JSON.parse(e.data);
  if (!remaining.has(jobId)) return;

  if (status === "Published") {
    console.log(`✓ ${jobId}: ${providerPostUrl ?? "(published, no public URL)"}`);
    remaining.delete(jobId);
  } else if (status === "Failed") {
    console.error(`✕ ${jobId}: ${errorMessage}`);
    remaining.delete(jobId);
  } else {
    console.log(`  ${jobId}: ${status}`);
  }

  if (remaining.size === 0) es.close();
});
```

---

## 5. End-to-end example (curl)

```bash
# 1. Find groups
curl http://localhost:20129/api/groups

# 2. Submit upload
curl -X POST http://localhost:20129/api/groups/group_Ab3Xy7Zq/upload-by-path \
  -H "Content-Type: application/json" \
  -d '{
    "videoPath": "C:\\Users\\you\\Videos\\clip.mp4",
    "title": "My Upload",
    "caption": "Check this out!",
    "privacy": "public"
  }'

# 3a. Stream live events for each returned job
curl -N http://localhost:20129/api/post-jobs/job_Kp2mNx4qRs/events

# 3b. Or one-shot poll
curl http://localhost:20129/api/post-jobs/job_Kp2mNx4qRs
```

---

## 6. Platform-specific notes

### YouTube
- Provides the real `videoId` immediately after upload.
- `providerPostUrl` is `https://www.youtube.com/watch?v=<videoId>`.

### TikTok
- The upload returns a `publish_id` first, then the real numeric `post_id` only appears after TikTok finishes processing **and** the post is approved for public viewership.
- If the app is unaudited, or `privacy=private`, or moderation is pending, you'll see `Published` with **no `providerPostUrl`** — that's normal. The video is on TikTok, just no public link.
- See https://developers.tiktok.com/doc/content-posting-api-reference-get-video-status for the underlying status semantics.

### Facebook Page (`platform: "meta"`)
- Multi-phase upload: 6Gate calls Meta's `start` → chunked `transfer` → `finish` → poll `status`.
- The job log shows phase markers (`Phase 1/4: requesting upload session`, `Uploaded X/Y bytes (N%)`, etc.).
- Set `contentType: "Reel"` on the upload to publish to Reels instead of regular Page video — uses `/video_reels` with the rupload URL flow. URL pattern `https://www.facebook.com/reel/<video_id>`.

---

## 7. Connection lifecycle & error handling

- **EventSource auto-reconnects** on transient network drops. You don't need to write reconnect logic for short blips.
- For long outages, the connection eventually closes. Detect this in `es.onerror` and reopen with exponential backoff (1s → 2s → 4s → cap 30s).
- If you missed events during a disconnect, refetch `GET /api/post-jobs/{jobId}` to get the current state, then resume streaming.
- **Server restart**: jobs in active statuses (`Uploading`/`Processing`/etc.) are reset to `Created` on the next start so they re-run. The original video file must still exist at `videoPath` — otherwise the job is marked `Failed`.

---

## 8. Idempotency

To safely retry submitting the same upload (e.g., your local app crashed before recording the job IDs), the underlying job creation supports an idempotency key. The group `upload-by-path` endpoint doesn't currently expose this — if you need it, hit the lower-level job API directly:

```http
POST /api/post-jobs
Content-Type: application/json

{
  "accountId": "...",
  "destinationId": "...",
  "videoPath": "C:\\...\\clip.mp4",
  "idempotencyKey": "my-app:upload:42"
}
```

Re-posting the same `idempotencyKey` returns the existing job's id instead of creating a duplicate.

---

## Summary cheat sheet

| You want to… | Use |
|---|---|
| Submit one upload to a group | `POST /api/groups/{id}/upload-by-path` |
| Watch each job live | `GET /api/post-jobs/{id}/events` (SSE, one stream per job) |
| Poll a single job | `GET /api/post-jobs/{id}` |
| List all jobs | `GET /api/post-jobs` |
| Retry a failed job | `POST /api/post-jobs/{id}/retry` |
| Cancel a queued or active job | `POST /api/post-jobs/{id}/cancel` |
| Find group/destination IDs | `GET /api/groups`, `GET /api/publish-destinations` |
