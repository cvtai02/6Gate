# Facebook Page Video / Reels Upload Resilient Job Plan

## Purpose

Facebook Page video publishing should be handled as a **resilient async job**.

Do not design it like:

```txt
upload video → wait in HTTP request → return success
```

Design it like:

```txt
create internal job
→ start Facebook upload session
→ upload video
→ finish/publish
→ poll video status
→ mark job as Published or Failed
```

---

## Facebook vs TikTok vs YouTube

```txt
TikTok:
publish_id now → post_id later

YouTube:
upload session URL → videoId after upload completes → processing later

Facebook Page:
video_id often created early → upload/finish/status later
```

For Facebook, store:

```txt
platformPostId   = Facebook video_id
uploadSessionId  = Facebook upload_session_id, for chunked Page videos
uploadUrl        = Facebook rupload URL, for Reels flow
```

---

# Supported Content Types

You should support Facebook Page video as two provider modes:

```txt
Facebook Page Video
Facebook Page Reel
```

They are similar but not exactly the same internally.

---

# Recommended Architecture

```txt
Client
  ↓
Your API
  ↓ create internal publish job
Database
  ↓ enqueue worker
Worker
  ↓ start Facebook upload
  ↓ upload video/chunks
  ↓ finish upload/publish
  ↓ poll status
Client watches your job status using polling or SSE
```

---

# Job Statuses

```ts
type PublishStatus =
  | "Created"
  | "Initializing"
  | "Uploading"
  | "Finishing"
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
type FacebookPublishJob = {
  id: string;

  platform: "FacebookPage";

  contentType: "Video" | "Reel";

  status: PublishStatus;

  userId: string;
  pageId: string;

  localVideoUrl: string;
  localVideoStorageKey: string;

  // Facebook IDs
  platformPostId?: string;      // Facebook video_id
  uploadSessionId?: string;     // normal Page video chunked upload
  uploadUrl?: string;           // Reels rupload URL
  startOffset?: string;
  endOffset?: string;

  title?: string;
  description?: string;

  scheduledPublishTime?: string;

  uploadedBytes: number;
  totalBytes: number;

  attemptCount: number;
  maxAttempts: number;

  nextAttemptAt?: string;

  lastErrorCode?: string;
  lastErrorSubcode?: string;
  lastErrorMessage?: string;
  lastTraceId?: string;

  lastNetworkError?: string;
  lastStatusCheckedAt?: string;

  reconnectRequiredReason?: string;

  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
};
```

---

# Required Access

Your app usually needs:

```txt
Facebook Login
Page access token
pages_show_list
pages_read_engagement
pages_manage_posts
```

Depending on your app mode and feature, Meta App Review may be required.

Use Page access token, not only user access token, when publishing to a Page.

---

# API Design

## Create Facebook Page publish job

```http
POST /api/social-posts/facebook-page
```

Request for normal Page video:

```json
{
  "contentType": "Video",
  "pageId": "123456",
  "videoId": "vid_123",
  "title": "My video",
  "description": "Video description"
}
```

Request for Page Reel:

```json
{
  "contentType": "Reel",
  "pageId": "123456",
  "videoId": "vid_123",
  "description": "Video description"
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
Return your internal jobId immediately.
Do not wait for Facebook upload/processing inside the API request.
```

---

## Get job status

```http
GET /api/social-posts/jobs/{jobId}
```

Response while uploading:

```json
{
  "jobId": "job_123",
  "platform": "FacebookPage",
  "contentType": "Reel",
  "status": "Uploading",
  "uploadedBytes": 10485760,
  "totalBytes": 52428800,
  "platformPostId": "FACEBOOK_VIDEO_ID"
}
```

Response when published:

```json
{
  "jobId": "job_123",
  "platform": "FacebookPage",
  "contentType": "Reel",
  "status": "Published",
  "platformPostId": "FACEBOOK_VIDEO_ID"
}
```

---

# Normal Facebook Page Video Flow

Normal Page video supports upload phases:

```txt
start
transfer
finish
cancel
```

Recommended flow:

```txt
1. Created
2. Initializing
3. Call start upload phase
4. Save video_id, upload_session_id, start_offset, end_offset
5. Upload chunks using transfer phase
6. Call finish phase
7. Move to Processing
8. Poll video status
9. Mark Published or Failed
```

---

## Step 1: Start Upload

Pseudo-code:

```ts
async function startFacebookPageVideoUpload(job: FacebookPublishJob) {
  const pageToken = await getValidFacebookPageToken(job.userId, job.pageId);

  const response = await facebook.startPageVideoUpload({
    pageId: job.pageId,
    accessToken: pageToken,
    fileSize: job.totalBytes
  });

  await updateJob(job.id, {
    status: "Uploading",
    platformPostId: response.video_id,
    uploadSessionId: response.upload_session_id,
    startOffset: response.start_offset,
    endOffset: response.end_offset
  });

  await enqueueJob(job.id);
}
```

Important:

```txt
If platformPostId or uploadSessionId already exists, do not call start again.
```

Otherwise you may create duplicate Facebook video objects.

---

## Step 2: Transfer Chunks

Pseudo-code:

```ts
async function transferFacebookVideoChunk(job: FacebookPublishJob) {
  const pageToken = await getValidFacebookPageToken(job.userId, job.pageId);

  const chunk = await storage.readRange({
    key: job.localVideoStorageKey,
    start: Number(job.startOffset),
    end: Number(job.endOffset)
  });

  const response = await facebook.transferPageVideoChunk({
    pageId: job.pageId,
    accessToken: pageToken,
    uploadSessionId: job.uploadSessionId,
    startOffset: job.startOffset,
    videoFileChunk: chunk
  });

  await updateJob(job.id, {
    startOffset: response.start_offset,
    endOffset: response.end_offset,
    uploadedBytes: Number(response.start_offset)
  });

  if (response.start_offset === response.end_offset) {
    await updateJob(job.id, {
      status: "Finishing"
    });
  }

  await enqueueJob(job.id);
}
```

---

## Step 3: Finish Upload

Pseudo-code:

```ts
async function finishFacebookPageVideoUpload(job: FacebookPublishJob) {
  const pageToken = await getValidFacebookPageToken(job.userId, job.pageId);

  await facebook.finishPageVideoUpload({
    pageId: job.pageId,
    accessToken: pageToken,
    uploadSessionId: job.uploadSessionId,
    title: job.title,
    description: job.description
  });

  await updateJob(job.id, {
    status: "Processing"
  });

  await enqueueJob(job.id, {
    delaySeconds: 15
  });
}
```

---

# Facebook Page Reels Flow

Facebook Page Reels use a slightly different flow.

Recommended flow:

```txt
1. Created
2. Initializing
3. POST /{page-id}/video_reels?upload_phase=start
4. Save video_id and upload_url
5. Upload video to upload_url
6. POST /{page-id}/video_reels?upload_phase=finish
7. Set video_state = PUBLISHED, DRAFT, or SCHEDULED
8. Poll status
9. Mark Published or Failed
```

---

## Step 1: Start Reel Upload

Pseudo-code:

```ts
async function startFacebookPageReelUpload(job: FacebookPublishJob) {
  const pageToken = await getValidFacebookPageToken(job.userId, job.pageId);

  const response = await facebook.startPageReelUpload({
    pageId: job.pageId,
    accessToken: pageToken
  });

  await updateJob(job.id, {
    status: "Uploading",
    platformPostId: response.video_id,
    uploadUrl: response.upload_url
  });

  await enqueueJob(job.id);
}
```

---

## Step 2: Upload Reel Binary

Pseudo-code:

```ts
async function uploadFacebookPageReel(job: FacebookPublishJob) {
  const pageToken = await getValidFacebookPageToken(job.userId, job.pageId);

  const videoStream = await storage.openRead(job.localVideoStorageKey);

  await facebook.uploadToRuploadUrl({
    uploadUrl: job.uploadUrl,
    accessToken: pageToken,
    fileSize: job.totalBytes,
    file: videoStream
  });

  await updateJob(job.id, {
    status: "Finishing",
    uploadedBytes: job.totalBytes
  });

  await enqueueJob(job.id);
}
```

---

## Step 3: Finish Reel

```ts
async function finishFacebookPageReel(job: FacebookPublishJob) {
  const pageToken = await getValidFacebookPageToken(job.userId, job.pageId);

  await facebook.finishPageReelUpload({
    pageId: job.pageId,
    accessToken: pageToken,
    videoId: job.platformPostId,
    videoState: "PUBLISHED",
    description: job.description
  });

  await updateJob(job.id, {
    status: "Processing"
  });

  await enqueueJob(job.id, {
    delaySeconds: 15
  });
}
```

Supported final intent:

```txt
DRAFT
PUBLISHED
SCHEDULED
```

For your app, start with:

```txt
PUBLISHED
DRAFT
```

Add scheduling later.

---

# Poll Facebook Video Status

After finish, poll the Facebook video object.

```http
GET /{video-id}?fields=status
```

Pseudo-code:

```ts
async function checkFacebookVideoStatus(job: FacebookPublishJob) {
  const pageToken = await getValidFacebookPageToken(job.userId, job.pageId);

  const video = await facebook.getVideoStatus({
    videoId: job.platformPostId,
    accessToken: pageToken
  });

  await updateJob(job.id, {
    lastStatusCheckedAt: new Date().toISOString()
  });

  if (isFacebookVideoReady(video.status)) {
    await updateJob(job.id, {
      status: "Published",
      publishedAt: new Date().toISOString()
    });

    return;
  }

  if (isFacebookVideoFailed(video.status)) {
    await updateJob(job.id, {
      status: "Failed",
      lastErrorMessage: "Facebook failed to process this video."
    });

    return;
  }

  await enqueueJob(job.id, {
    delaySeconds: 30
  });
}
```

---

# Worker Design

```ts
async function processFacebookPageJob(jobId: string) {
  const job = await db.jobs.find(jobId);

  if (!job) return;

  if (job.status === "Cancelled") return;
  if (job.status === "Published") return;
  if (job.status === "Failed") return;

  try {
    if (job.status === "Created") {
      await initializeFacebookJob(job);
      return;
    }

    if (job.status === "Uploading") {
      await continueFacebookUpload(job);
      return;
    }

    if (job.status === "Finishing") {
      await finishFacebookUpload(job);
      return;
    }

    if (job.status === "Processing") {
      await checkFacebookVideoStatus(job);
      return;
    }

    if (job.status === "ReconnectRequired") {
      return;
    }
  } catch (error) {
    await handleFacebookJobError(job, error);
  }
}
```

---

# Initialize By Content Type

```ts
async function initializeFacebookJob(job: FacebookPublishJob) {
  await updateJob(job.id, {
    status: "Initializing"
  });

  if (job.contentType === "Video") {
    await startFacebookPageVideoUpload(job);
    return;
  }

  if (job.contentType === "Reel") {
    await startFacebookPageReelUpload(job);
    return;
  }

  throw new Error("Unsupported Facebook content type.");
}
```

---

# Continue Upload By Content Type

```ts
async function continueFacebookUpload(job: FacebookPublishJob) {
  if (job.contentType === "Video") {
    await transferFacebookVideoChunk(job);
    return;
  }

  if (job.contentType === "Reel") {
    await uploadFacebookPageReel(job);
    return;
  }

  throw new Error("Unsupported Facebook content type.");
}
```

---

# Finish By Content Type

```ts
async function finishFacebookUpload(job: FacebookPublishJob) {
  if (job.contentType === "Video") {
    await finishFacebookPageVideoUpload(job);
    return;
  }

  if (job.contentType === "Reel") {
    await finishFacebookPageReel(job);
    return;
  }

  throw new Error("Unsupported Facebook content type.");
}
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
429 rate_limit
temporary_facebook_error
```

For rate limits, use longer backoff.

---

## ReconnectRequired Errors

Ask user to reconnect Facebook:

```txt
access_token_expired
invalid_token
user_revoked_access
page_permission_missing
page_access_token_invalid
pages_manage_posts_missing
```

Set:

```ts
status = "ReconnectRequired";
reconnectRequiredReason = "Facebook Page connection expired or permission was revoked.";
```

---

## Permanent Failed Errors

Do not retry automatically:

```txt
unsupported_video_format
video_too_large
invalid_page_id
page_not_found
user_not_page_admin
content_policy_rejected
scheduled_time_invalid
invalid_metadata
```

Set:

```ts
status = "Failed";
lastErrorMessage = "User-friendly reason here";
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

# Network Failure Handling

## Normal Page Video

If chunk transfer fails:

```txt
do not restart
do not start a new upload session
retry same upload_session_id and current start_offset
```

If result is unknown:

```txt
1. Keep upload_session_id
2. Re-enqueue job
3. Continue from latest known start_offset
4. If Facebook says session invalid, classify error
```

---

## Page Reel

If upload to `upload_url` fails before bytes are sent:

```txt
retry same upload_url
```

If upload result is unknown:

```txt
1. Do not start new Reel immediately
2. Try finish call or poll video status
3. If Facebook says video not uploaded, retry upload
4. If Facebook says video exists/processing, move to Processing
```

Reason:

```txt
The upload may have succeeded even if your app did not receive the response.
```

---

# Reconnect Flow

When auth fails:

```txt
status = ReconnectRequired
```

Frontend shows:

```txt
Facebook Page connection expired. Please reconnect Facebook to continue.
```

After user reconnects:

```ts
async function resumeFacebookAfterReconnect(jobId: string) {
  const job = await db.jobs.find(jobId);

  if (job.status !== "ReconnectRequired") return;

  if (job.platformPostId && job.status !== "Published") {
    await updateJob(job.id, {
      status: "Processing"
    });
  } else if (job.uploadSessionId || job.uploadUrl) {
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
Has platformPostId and upload likely finished → poll status
Has uploadSessionId/uploadUrl → continue upload
Has neither → start upload
```

---

# Idempotency

Use idempotency key:

```http
POST /api/social-posts/facebook-page
Idempotency-Key: user_123_video_456_facebook_page_789
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
unique(userId, localVideoId, platform, pageId, contentType, idempotencyKey)
```

Optional protection:

```txt
Only one active publish job per video/page/contentType.
```

Active statuses:

```txt
Created
Initializing
Uploading
Finishing
Processing
Retrying
ReconnectRequired
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
data: {"status":"Processing","platformPostId":"FACEBOOK_VIDEO_ID"}

event: status
data: {"status":"Published","platformPostId":"FACEBOOK_VIDEO_ID"}
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
        setFacebookVideoId(data.platformPostId);
        events.close();
      }

      if (data.status === "Failed") {
        setError(data.lastErrorMessage);
        events.close();
      }

      if (data.status === "ReconnectRequired") {
        showReconnectFacebookButton();
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

# Stuck Job Recovery

Run every few minutes:

```ts
async function recoverStuckFacebookJobs() {
  const jobs = await db.jobs.findMany({
    where: {
      platform: "FacebookPage",
      status: ["Uploading", "Finishing", "Processing", "Retrying"],
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
browser closed
network interruption
SSE disconnected
```

---

# User-Facing Messages

## Uploading

```txt
Uploading your video to Facebook...
```

## Processing

```txt
Facebook is processing your video...
```

## Temporary network issue

```txt
We are having trouble reaching Facebook. Your upload job is still safe.
```

## Reconnect required

```txt
Facebook Page connection expired. Please reconnect Facebook to continue.
```

## Failed

```txt
Facebook could not publish this video. Please check the file, Page permission, or content rules.
```

## Published

```txt
Your video was published to Facebook successfully.
```

---

# Keep Original Video Until Final State

Do not delete the local/R2/S3 video file until:

```txt
Published
Failed and no retry needed
Cancelled
```

Reason:

```txt
Retry and recovery workers may need the original file.
```

---

# Outbox Pattern

Recommended for reliability:

```txt
API saves job
API saves outbox message in same database transaction
Worker reads outbox
Worker processes Facebook upload
```

Minimal table:

```ts
type OutboxMessage = {
  id: string;
  type: "ProcessFacebookPagePublishJob";
  payload: {
    jobId: string;
  };
  status: "Pending" | "Processing" | "Done" | "Failed";
  attemptCount: number;
  nextAttemptAt?: string;
  createdAt: string;
};
```

---

# Adapter Interface

Use one app-level abstraction:

```ts
interface SocialVideoPublisher {
  createJob(input: CreatePublishJobInput): Promise<PublishJob>;

  processJob(jobId: string): Promise<void>;

  getStatus(jobId: string): Promise<PublishJobStatus>;

  resumeAfterReconnect(jobId: string): Promise<void>;
}
```

Implement:

```txt
TikTokPublisher
YouTubePublisher
FacebookPagePublisher
InstagramPublisher
```

---

# Provider Internal Differences

```txt
TikTok:
publish_id + status polling

YouTube:
uploadSessionUrl + resumable upload + videoId + processing polling

Facebook Page Video:
video_id + upload_session_id + chunk transfer + finish + status polling

Facebook Page Reel:
video_id + upload_url + finish + status polling
```

---

# Best Simple Version

Start with:

```txt
1. Create internal job
2. Start Facebook upload
3. Save video_id
4. Upload video
5. Finish/publish
6. Poll status
7. Retry temporary/network errors
8. Mark ReconnectRequired for auth/permission issues
9. Mark Published when Facebook says ready
10. Frontend polls your job endpoint
```

Add later:

```txt
SSE
outbox
stuck-job recovery
scheduled publishing
multi-page publishing
webhook support if available for your app use case
```

---

# Production Checklist

```txt
[ ] Store internal job ID
[ ] Store Facebook video_id
[ ] Store upload_session_id for Page videos
[ ] Store upload_url for Reels
[ ] Store uploadedBytes and totalBytes
[ ] Add idempotency key
[ ] Prevent duplicate posts
[ ] Add retry count
[ ] Add nextAttemptAt
[ ] Add ReconnectRequired status
[ ] Add Page token refresh/reconnect logic
[ ] Add status polling
[ ] Add SSE endpoint
[ ] Add polling fallback
[ ] Add stuck-job recovery
[ ] Keep original file until final state
[ ] Store Facebook error code/subcode/message/trace ID
[ ] Test normal video separately from Reel
```

---

# Final Recommendation

Use the same job system as TikTok and YouTube.

But Facebook provider internals should branch by content type:

```txt
Facebook Page Video → upload_phase start/transfer/finish
Facebook Page Reel  → video_reels start/upload_url/finish
```

Your frontend should not care about these differences.

Frontend only watches:

```txt
Created
Uploading
Processing
Published
Failed
ReconnectRequired
```
