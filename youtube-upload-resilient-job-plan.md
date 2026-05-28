# YouTube Video Upload Resilient Job Plan

## Purpose

YouTube upload should be handled as a **resilient async publish job**.

Even though YouTube can return the final `videoId` after upload completes, the video may still need time for processing.

```txt
User selects video
→ Your app creates internal publish job
→ Your app starts YouTube resumable upload session
→ Your worker uploads chunks
→ YouTube returns videoId when upload completes
→ Your app polls processing status
→ Job becomes Published when YouTube processing succeeds
```

---

## TikTok vs YouTube Difference

```txt
TikTok:
init → publish_id now → post_id later

YouTube:
resumable upload → videoId after upload completes → processing completes later
```

For YouTube, save:

```txt
uploadSessionUrl = resumable upload URL
platformPostId  = YouTube videoId
```

---

# Recommended Architecture

```txt
Client
  ↓
Your API
  ↓ create internal job
Database
  ↓ enqueue worker
Worker
  ↓ create YouTube resumable upload session
  ↓ upload video chunks
  ↓ save videoId
  ↓ poll processing status
Client watches your job status
```

---

# Job Statuses

```ts
type PublishStatus =
  | "Created"
  | "Initializing"
  | "Uploading"
  | "Processing"
  | "Published"
  | "Failed"
  | "Retrying"
  | "ReconnectRequired"
  | "Cancelled";
```

---

# Database Model

```ts
type SocialPublishJob = {
  id: string;

  platform: "YouTube";

  status: PublishStatus;

  userId: string;
  videoId: string;

  localVideoUrl: string;
  localVideoStorageKey: string;

  uploadSessionUrl?: string;

  platformPostId?: string; // YouTube video ID

  title: string;
  description?: string;

  privacyStatus: "private" | "unlisted" | "public";

  categoryId?: string;
  tags?: string[];

  madeForKids?: boolean;

  uploadedBytes: number;
  totalBytes: number;

  attemptCount: number;
  maxAttempts: number;

  nextAttemptAt?: string;

  lastErrorCode?: string;
  lastErrorMessage?: string;

  lastNetworkError?: string;
  lastStatusCheckedAt?: string;

  reconnectRequiredReason?: string;

  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
};
```

---

# Status Flow

```txt
Created
  ↓
Initializing
  ↓
Uploading
  ↓
Processing
  ↓
Published
```

Retry path:

```txt
Uploading / Processing
  ↓
Retrying
  ↓
resume previous step
```

Auth issue path:

```txt
Initializing / Uploading / Processing
  ↓
ReconnectRequired
  ↓ user reconnects Google/YouTube
  ↓ resume existing job
```

Permanent error path:

```txt
Failed
```

---

# API Design

## Create YouTube publish job

```http
POST /api/social-posts/youtube
```

Request:

```json
{
  "videoId": "vid_123",
  "title": "My video",
  "description": "Video description",
  "privacyStatus": "private",
  "madeForKids": false
}
```

Response:

```json
{
  "jobId": "job_123",
  "status": "Created"
}
```

Important:

```txt
Return your jobId immediately.
Do not wait until YouTube finishes upload/processing.
```

---

## Get job status

```http
GET /api/social-posts/jobs/{jobId}
```

Processing response:

```json
{
  "jobId": "job_123",
  "platform": "YouTube",
  "status": "Uploading",
  "uploadedBytes": 10485760,
  "totalBytes": 52428800,
  "platformPostId": null
}
```

Published response:

```json
{
  "jobId": "job_123",
  "platform": "YouTube",
  "status": "Published",
  "platformPostId": "YOUTUBE_VIDEO_ID"
}
```

---

# Upload Flow

## Step 1: Create resumable upload session

Your worker calls YouTube `videos.insert` with:

```txt
uploadType=resumable
part=snippet,status
```

Metadata:

```json
{
  "snippet": {
    "title": "My video",
    "description": "Video description",
    "tags": ["tag1", "tag2"],
    "categoryId": "22"
  },
  "status": {
    "privacyStatus": "private",
    "selfDeclaredMadeForKids": false
  }
}
```

YouTube returns a resumable session URL in the `Location` header.

Save it:

```ts
job.uploadSessionUrl = response.headers.location;
job.status = "Uploading";
```

Important:

```txt
If uploadSessionUrl already exists, do not create a new upload session.
```

---

## Step 2: Upload chunks

Upload video bytes to `uploadSessionUrl`.

Use chunks instead of one big upload.

Recommended chunk size:

```txt
8 MB, 16 MB, or 32 MB
```

Example request:

```http
PUT {uploadSessionUrl}
Content-Length: 8388608
Content-Range: bytes 0-8388607/52428800
```

---

# Network Failure Handling

YouTube resumable upload is good for network recovery.

If upload fails:

```txt
do not restart from zero
do not create a new video
ask YouTube how many bytes were received
resume from next byte
```

---

## Check uploaded byte position

Send an empty `PUT` request:

```http
PUT {uploadSessionUrl}
Content-Length: 0
Content-Range: bytes */{TOTAL_BYTES}
```

Possible response:

```txt
308 Resume Incomplete
Range: bytes=0-10485759
```

This means YouTube received bytes:

```txt
0 through 10485759
```

Resume from:

```txt
10485760
```

---

## Resume upload

```http
PUT {uploadSessionUrl}
Content-Length: {remainingBytes}
Content-Range: bytes 10485760-52428799/52428800
```

---

# Retry Strategy

Use exponential backoff with jitter.

```ts
function getRetryDelaySeconds(attempt: number) {
  const base = Math.min(300, 2 ** attempt * 5);
  const jitter = Math.floor(Math.random() * 10);

  return base + jitter;
}
```

Example:

```txt
attempt 1 → ~5s
attempt 2 → ~10s
attempt 3 → ~20s
attempt 4 → ~40s
attempt 5 → ~80s
attempt 6 → ~160s
attempt 7+ → cap around 5 minutes
```

---

# Error Classification

## Retryable Errors

Retry automatically:

```txt
network_timeout
connection_reset
dns_error
500 internal_error
502 bad_gateway
503 service_unavailable
504 gateway_timeout
429 rate_limit_exceeded
```

For `429`, use longer delay.

---

## ReconnectRequired Errors

Ask user to reconnect Google/YouTube:

```txt
invalid_grant
access_token_expired
refresh_token_expired
user_revoked_access
insufficient_permissions
youtube_upload_scope_missing
```

Set:

```ts
status = "ReconnectRequired";
reconnectRequiredReason = "YouTube authorization expired or permission was revoked.";
```

---

## Permanent Failed Errors

Do not retry automatically:

```txt
quota_exceeded
invalid_video_metadata
invalid_privacy_status
invalid_made_for_kids_setting
unsupported_file_format
file_too_large
channel_suspended
upload_not_allowed
```

Set:

```ts
status = "Failed";
lastErrorMessage = "User-friendly reason here";
```

---

# Worker Design

```ts
async function processYouTubeJob(jobId: string) {
  const job = await db.jobs.find(jobId);

  if (!job) return;

  if (job.status === "Cancelled") return;
  if (job.status === "Published") return;
  if (job.status === "Failed") return;

  try {
    if (!job.uploadSessionUrl && !job.platformPostId) {
      await initializeYouTubeUpload(job);
      return;
    }

    if (job.status === "Uploading") {
      await uploadOrResumeYouTubeVideo(job);
      return;
    }

    if (job.status === "Processing") {
      await checkYouTubeProcessingStatus(job);
      return;
    }

    if (job.status === "ReconnectRequired") {
      return;
    }
  } catch (error) {
    await handleYouTubeJobError(job, error);
  }
}
```

---

# Initialize Upload

```ts
async function initializeYouTubeUpload(job: SocialPublishJob) {
  await updateJob(job.id, {
    status: "Initializing"
  });

  const token = await getValidGoogleToken(job.userId);

  const response = await youtube.createResumableUploadSession({
    accessToken: token.accessToken,
    title: job.title,
    description: job.description,
    privacyStatus: job.privacyStatus,
    madeForKids: job.madeForKids,
    totalBytes: job.totalBytes
  });

  await updateJob(job.id, {
    status: "Uploading",
    uploadSessionUrl: response.uploadSessionUrl
  });

  await enqueueJob(job.id);
}
```

---

# Upload Or Resume

```ts
async function uploadOrResumeYouTubeVideo(job: SocialPublishJob) {
  const token = await getValidGoogleToken(job.userId);

  const uploadedBytes = await youtube.getUploadedBytes({
    accessToken: token.accessToken,
    uploadSessionUrl: job.uploadSessionUrl,
    totalBytes: job.totalBytes
  });

  await updateJob(job.id, {
    uploadedBytes
  });

  const result = await youtube.uploadRemainingBytes({
    accessToken: token.accessToken,
    uploadSessionUrl: job.uploadSessionUrl,
    localVideoStorageKey: job.localVideoStorageKey,
    startByte: uploadedBytes,
    totalBytes: job.totalBytes
  });

  if (result.videoId) {
    await updateJob(job.id, {
      status: "Processing",
      platformPostId: result.videoId,
      uploadedBytes: job.totalBytes
    });

    await enqueueJob(job.id, {
      delaySeconds: 15
    });
  }
}
```

---

# Unknown Upload Result

If connection fails after sending bytes:

```txt
The upload may have succeeded.
```

Do not create a new upload.

Do this:

```txt
1. Query upload session status
2. Read Range header
3. Resume from next byte
4. If upload completed, YouTube returns final video resource
```

---

# Processing Status Polling

After upload completes, poll:

```http
GET /youtube/v3/videos?part=status,processingDetails&id={YOUTUBE_VIDEO_ID}
```

Possible processing statuses:

```txt
processing
succeeded
failed
terminated
```

Worker:

```ts
async function checkYouTubeProcessingStatus(job: SocialPublishJob) {
  const token = await getValidGoogleToken(job.userId);

  const video = await youtube.getVideo({
    accessToken: token.accessToken,
    videoId: job.platformPostId,
    part: "status,processingDetails"
  });

  await updateJob(job.id, {
    lastStatusCheckedAt: new Date().toISOString()
  });

  if (video.processingDetails.processingStatus === "succeeded") {
    await updateJob(job.id, {
      status: "Published",
      publishedAt: new Date().toISOString()
    });

    return;
  }

  if (
    video.processingDetails.processingStatus === "failed" ||
    video.processingDetails.processingStatus === "terminated"
  ) {
    await updateJob(job.id, {
      status: "Failed",
      lastErrorCode: video.processingDetails.processingFailureReason,
      lastErrorMessage: "YouTube failed to process this video."
    });

    return;
  }

  await enqueueJob(job.id, {
    delaySeconds: 30
  });
}
```

---

# Privacy Status Strategy

Recommended default:

```txt
private
```

Then allow user to choose:

```txt
private
unlisted
public
```

Why default private?

```txt
safer during testing
avoids accidentally publishing bad uploads
some unverified apps may have public upload restrictions
```

---

# Frontend UX

After user clicks publish:

```txt
1. POST /api/social-posts/youtube
2. Receive jobId
3. Show progress screen
4. Use SSE or polling
5. Show published link when platformPostId exists
```

UI states:

```txt
Created       → Preparing YouTube upload...
Initializing  → Connecting to YouTube...
Uploading     → Uploading video...
Processing    → YouTube is processing your video...
Published     → Published successfully
Failed        → Upload failed
Retrying      → Temporary issue, retrying...
ReconnectRequired → Please reconnect YouTube
```

---

# SSE Endpoint

```http
GET /api/social-posts/jobs/{jobId}/events
```

Events:

```txt
event: status
data: {"status":"Uploading","uploadedBytes":10485760,"totalBytes":52428800}

event: status
data: {"status":"Processing","platformPostId":"YOUTUBE_VIDEO_ID"}

event: status
data: {"status":"Published","platformPostId":"YOUTUBE_VIDEO_ID"}
```

---

# SSE Client With Reconnect

```ts
function watchPublishJob(jobId: string) {
  let retryCount = 0;
  let sseFailedCount = 0;

  function connect() {
    const events = new EventSource(`/api/social-posts/jobs/${jobId}/events`);

    events.addEventListener("status", (event) => {
      retryCount = 0;

      const data = JSON.parse(event.data);

      setStatus(data.status);

      if (data.uploadedBytes && data.totalBytes) {
        setProgress(data.uploadedBytes / data.totalBytes);
      }

      if (data.status === "Published") {
        setYouTubeVideoId(data.platformPostId);
        events.close();
      }

      if (data.status === "Failed") {
        setError(data.lastErrorMessage);
        events.close();
      }

      if (data.status === "ReconnectRequired") {
        showReconnectYouTubeButton();
        events.close();
      }
    });

    events.onerror = () => {
      events.close();

      retryCount++;
      sseFailedCount++;

      if (sseFailedCount >= 3) {
        fallbackPoll(jobId);
        return;
      }

      const delay = Math.min(30000, 1000 * 2 ** retryCount);
      setTimeout(connect, delay);
    };
  }

  connect();
}
```

---

# Polling Fallback

```ts
async function fallbackPoll(jobId: string) {
  const interval = setInterval(async () => {
    const res = await fetch(`/api/social-posts/jobs/${jobId}`);
    const job = await res.json();

    setStatus(job.status);

    if (job.uploadedBytes && job.totalBytes) {
      setProgress(job.uploadedBytes / job.totalBytes);
    }

    if (
      job.status === "Published" ||
      job.status === "Failed" ||
      job.status === "ReconnectRequired"
    ) {
      clearInterval(interval);
    }
  }, 5000);
}
```

---

# Reconnect Flow

If Google/YouTube token fails:

```txt
status = ReconnectRequired
```

Frontend:

```txt
Your YouTube connection expired. Please reconnect YouTube to continue.
```

After reconnect:

```ts
async function resumeAfterReconnect(jobId: string) {
  const job = await db.jobs.find(jobId);

  if (job.status !== "ReconnectRequired") return;

  if (job.platformPostId) {
    await updateJob(job.id, {
      status: "Processing"
    });
  } else if (job.uploadSessionUrl) {
    await updateJob(job.id, {
      status: "Uploading"
    });
  } else {
    await updateJob(job.id, {
      status: "Created"
    });
  }

  await enqueueJob(job.id);
}
```

Resume rule:

```txt
Has platformPostId   → poll processing
Has uploadSessionUrl → resume upload
Has neither          → create upload session
```

---

# Idempotency

Use idempotency key:

```http
POST /api/social-posts/youtube
Idempotency-Key: user_123_video_456_youtube
```

If same request is repeated:

```json
{
  "jobId": "job_123",
  "status": "Uploading"
}
```

Database constraint:

```txt
unique(userId, videoId, platform, idempotencyKey)
```

---

# Stuck Job Recovery

Run every few minutes:

```ts
async function recoverStuckYouTubeJobs() {
  const jobs = await db.jobs.findMany({
    where: {
      status: ["Uploading", "Processing", "Retrying"],
      updatedAtOlderThanMinutes: 10
    }
  });

  for (const job of jobs) {
    await enqueueJob(job.id);
  }
}
```

This handles:

```txt
worker crash
server restart
queue message lost
network interruption
browser closed
SSE disconnected
```

---

# Quota Notes

YouTube upload is quota-expensive.

Important:

```txt
videos.insert costs high quota
failed requests can still consume quota
avoid duplicate uploads
use idempotency
do not retry permanent errors blindly
```

---

# Best Simple Version

Start with this:

```txt
1. Create internal job
2. Start YouTube resumable upload
3. Save uploadSessionUrl
4. Upload chunks
5. Resume upload on network failure
6. Save YouTube videoId after upload completes
7. Poll processingDetails
8. Mark Published when processing succeeds
9. Frontend polls job status
```

Add later:

```txt
SSE live updates
outbox table
recovery worker
better quota management
multi-platform adapter abstraction
```

---

# Production Checklist

```txt
[ ] Store internal job ID
[ ] Store uploadSessionUrl
[ ] Store YouTube videoId
[ ] Store uploadedBytes and totalBytes
[ ] Use resumable upload
[ ] Resume from Range header after failure
[ ] Add idempotency key
[ ] Add retry count
[ ] Add nextAttemptAt
[ ] Add ReconnectRequired status
[ ] Add processing status polling
[ ] Add SSE endpoint
[ ] Add polling fallback
[ ] Add stuck-job recovery
[ ] Avoid duplicate videos
[ ] Keep original file until final state
[ ] Start with privacyStatus=private
```

---

# Recommended Platform Adapter Interface

```ts
interface SocialVideoPublisher {
  createJob(input: CreatePublishJobInput): Promise<PublishJob>;

  processJob(jobId: string): Promise<void>;

  getStatus(jobId: string): Promise<PublishJobStatus>;

  resumeAfterReconnect(jobId: string): Promise<void>;
}
```

You can implement:

```txt
TikTokPublisher
YouTubePublisher
FacebookReelsPublisher
InstagramReelsPublisher
```

Same app-level job model, different provider internals.

---

# Final Recommendation

Use the same job system as TikTok, but customize YouTube internals:

```txt
TikTok provider:
publish_id + status polling

YouTube provider:
uploadSessionUrl + resumable chunks + videoId + processing polling
```

The most important YouTube feature is:

```txt
resumable upload
```

It lets your app survive network errors without restarting large video uploads.
