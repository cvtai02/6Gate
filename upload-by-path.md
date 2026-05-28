# Upload Video by Absolute Path to a Group

Upload a locally stored video file to all destinations in a 6Gate group by providing the absolute file path. No file transfer over HTTP — the server reads the file directly from disk.

**Base URL:** `http://localhost:20129`

---

## Endpoint

```
POST /api/groups/{groupId}/upload-by-path
Content-Type: application/json
```

### Path parameters

| Parameter | Type   | Description                            |
|-----------|--------|----------------------------------------|
| `groupId` | string | Group ID (e.g. `group_Ab3Xy7Zq`)       |

### Request body

```json
{
  "videoPath": "C:\\Users\\you\\Videos\\my-video.mp4",
  "title": "My Video Title",
  "caption": "#hashtag caption text",
  "privacy": "public"
}
```

| Field       | Type   | Required | Description                                     |
|-------------|--------|----------|-------------------------------------------------|
| `videoPath` | string | Yes      | Absolute path to the video file on disk         |
| `title`     | string | No       | Video title (used by YouTube; ignored by others)|
| `caption`   | string | No       | Caption / description shown on the post         |
| `privacy`   | string | No       | `"public"`, `"private"`, or `"unlisted"`        |

### Success response — `200 OK`

```json
{
  "groupId": "group_Ab3Xy7Zq",
  "jobs": [
    {
      "id": "job_Kp2mNx4qRs",
      "destinationId": "dest_Yz9wQv1b",
      "destinationName": "My YouTube Channel",
      "platform": "youtube"
    },
    {
      "id": "job_Rn7tLk0dFw",
      "destinationId": "dest_Mn3cBa8e",
      "destinationName": "My TikTok Account",
      "platform": "tiktok"
    }
  ]
}
```

Each item in `jobs` is a background publish job. Jobs run asynchronously — the endpoint returns immediately and publishing happens in the background.

### Error responses

| Status | Body                                        | Cause                                  |
|--------|---------------------------------------------|----------------------------------------|
| 400    | `{ "error": "videoPath is required" }`      | Missing `videoPath` field              |
| 400    | `{ "error": "File not found: <path>" }`     | File does not exist at the given path  |
| 400    | `{ "error": "Group has no destinations" }`  | Group exists but has no linked accounts|
| 500    | `{ "error": "..." }`                        | Internal server error                  |

---

## How to find your group ID

```
GET /api/groups
```

Returns all groups with their linked destinations:

```json
[
  {
    "id": "group_Ab3Xy7Zq",
    "name": "My Posting Group",
    "createdAt": "2025-01-15T10:00:00.000Z",
    "destinations": [
      {
        "destinationId": "dest_Yz9wQv1b",
        "name": "My YouTube Channel",
        "type": "youtube_channel",
        "providerType": "youtube"
      }
    ]
  }
]
```

---

## Tracking job status

After submitting, poll each job by ID:

```
GET /api/post-jobs/{jobId}
```

```json
{
  "id": "job_Kp2mNx4qRs",
  "status": "queued",
  "platform": "youtube",
  "videoPath": "C:\\Users\\you\\Videos\\my-video.mp4",
  "title": "My Video Title",
  "providerPostId": null,
  "providerPostUrl": null,
  "errorMessage": null,
  "createdAt": "2025-01-15T10:01:00.000Z",
  "updatedAt": "2025-01-15T10:01:05.000Z"
}
```

**Job statuses:**

| Status      | Meaning                                  |
|-------------|------------------------------------------|
| `queued`    | Waiting to be processed                  |
| `running`   | Upload in progress                       |
| `completed` | Published; `providerPostUrl` is set      |
| `failed`    | Failed; `errorMessage` is set            |

To retry a failed job:

```
POST /api/post-jobs/{jobId}/retry
```

---

## Live updates via SSE (recommended)

Two Server-Sent Events streams are available. Prefer SSE over polling — the connection stays open and the server pushes events as they happen.

### 1. Stream a single job

```
GET /api/post-jobs/{jobId}/events
Accept: text/event-stream
```

Sends past logs first, then live `log` and `status` events. The connection closes automatically once the job reaches `completed` or `failed`.

Event types:

```
event: log
data: {"level":"info","message":"Uploading video...","createdAt":"2025-01-15T10:01:02Z"}

event: status
data: {"status":"running"}

event: status
data: {"status":"completed","providerPostId":"abc123","providerPostUrl":"https://youtube.com/watch?v=abc123"}
```

### 2. Stream **all** jobs (global)

```
GET /api/post-jobs/stream
Accept: text/event-stream
```

Best fit for a local app that wants a live dashboard of every job without polling. The first message is a `snapshot` of current jobs; afterward, every status change is pushed as a `status` event with the `jobId` included.

Event sequence:

```
event: snapshot
data: [{ "id":"job_Kp2mNx4qRs","status":"queued",... }, ...]

event: status
data: {"jobId":"job_Kp2mNx4qRs","status":"running"}

event: status
data: {"jobId":"job_Kp2mNx4qRs","status":"completed","providerPostId":"abc123","providerPostUrl":"https://youtube.com/watch?v=abc123"}

event: status
data: {"jobId":"job_RnA2Xy90Lp","status":"failed","errorMessage":"Account token expired"}
```

A comment line `: ping` is sent every 25 seconds as a heartbeat — ignore it. The connection stays open until the client disconnects.

### Client example (browser / Electron)

```js
const es = new EventSource("http://localhost:20129/api/post-jobs/stream");

es.addEventListener("snapshot", (e) => {
  const jobs = JSON.parse(e.data);
  // hydrate UI
});

es.addEventListener("status", (e) => {
  const { jobId, status, providerPostUrl, errorMessage } = JSON.parse(e.data);
  // update the row for jobId
});

es.onerror = () => {
  // EventSource auto-reconnects; add exponential backoff if needed
};
```

### Client example (Node.js)

```js
import { EventSource } from "eventsource"; // npm i eventsource
const es = new EventSource("http://localhost:20129/api/post-jobs/stream");
es.addEventListener("status", (e) => console.log(JSON.parse(e.data)));
```

---

## Full example (curl)

```bash
# 1. List groups to get group ID
curl http://localhost:20129/api/groups

# 2. Enqueue upload
curl -X POST http://localhost:20129/api/groups/group_Ab3Xy7Zq/upload-by-path \
  -H "Content-Type: application/json" \
  -d '{
    "videoPath": "C:\\Users\\you\\Videos\\clip.mp4",
    "title": "My Upload",
    "caption": "Check this out!",
    "privacy": "public"
  }'

# 3a. Poll job status (simple)
curl http://localhost:20129/api/post-jobs/job_Kp2mNx4qRs

# 3b. OR subscribe to live updates for all jobs (recommended)
curl -N http://localhost:20129/api/post-jobs/stream
```

---

## Notes

- The server must be running at `http://localhost:20129` (default port).
- **CORS:** all `/api/*` endpoints return `Access-Control-Allow-Origin: *`, so the consuming app can call them from any origin (browser, Electron, native shell, etc.) without proxying.
- The video file must be readable by the process running the 6Gate server.
- On Windows, use either double-backslashes (`C:\\Users\\...`) or forward slashes (`C:/Users/...`) in JSON strings.
- The file is **not copied** — the job references the original path. Do not move or delete the file until the job reaches `success`.
- Supported video formats: mp4, mov, avi, mkv — any format accepted by the target platform.
