# TikTok Upload Resilient Job Plan

## Purpose

TikTok upload/publish should be handled as a **resilient async job**.

Do not design it like:

```txt
upload video -> wait -> return TikTok post_id
```

Design it like:

```txt
create internal job
-> call TikTok init
-> upload video
-> process async
-> poll/webhook status
-> save TikTok post_id later
```

TikTok can return a `publish_id` first, while the final `post_id` may only be available later after processing/moderation.

---

## Core Idea

Your app owns the job lifecycle.

TikTok owns the publish lifecycle.

```txt
Your Job ID       = source of truth in your app
TikTok publish_id = TikTok tracking ID
TikTok post_id    = final published video/post ID
```

---

## Recommended Job Statuses

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

## Database Fields

```ts
type SocialPublishJob = {
  id: string;

  platform: "TikTok";

  status: PublishStatus;

  localVideoUrl: string;
  localVideoStorageKey: string;

  platformPublishId?: string;
  platformPostId?: string;

  uploadUrl?: string;

  title?: string;
  description?: string;
  privacyLevel?: string;

  attemptCount: number;
  maxAttempts: number;

  nextAttemptAt?: string;

  lastErrorCode?: string;
  lastErrorMessage?: string;
  lastProviderLogId?: string;

  lastNetworkError?: string;
  lastStatusCheckedAt?: string;

  reconnectRequiredReason?: string;

  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
};
```

---

## Important Rules

## 1. Never fail immediately on network error

Network errors are usually temporary.

Examples:

```txt
timeout
DNS error
connection reset
502
503
504
temporary TikTok internal error
```

Handle these with retry:

```txt
status = Retrying
nextAttemptAt = now + backoff
```

---

## 2. Only mark Failed for permanent errors

Permanent errors:

```txt
invalid video format
file too large
invalid privacy setting
missing required field
user banned from posting
scope not authorized
permission missing
```

These require user action.

---

## 3. ReconnectRequired is different from Failed

Use `ReconnectRequired` when TikTok auth is broken.

Examples:

```txt
access token expired and refresh failed
user revoked app permission
missing video.publish scope
missing video.upload scope
```

This is not a publish bug.

The user needs to reconnect TikTok.

---

# Full Job Flow

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
Initializing / Uploading / Processing
  ↓
Retrying
  ↓
same previous step
```

Auth failure path:

```txt
Initializing / Uploading / Processing
  ↓
ReconnectRequired
  ↓ user reconnects TikTok
  ↓ resume job
```

Permanent failure path:

```txt
Initializing / Uploading / Processing
  ↓
Failed
```

---

# Error Classification

## Retryable Errors

Retry these automatically:

```txt
network_timeout
connection_reset
dns_error
temporary_unavailable
500 internal_error
502 bad_gateway
503 service_unavailable
504 gateway_timeout
429 rate_limit_exceeded
```

For `429`, use a longer delay.

---

## Reconnect Errors

Ask user to reconnect TikTok:

```txt
access_token_invalid
scope_not_authorized
scope_permission_missed
refresh_token_expired
user_revoked_access
```

Set:

```ts
status = "ReconnectRequired";
reconnectRequiredReason = "TikTok account needs to be reconnected.";
```

---

## Permanent Failed Errors

Do not retry automatically:

```txt
invalid_file_upload
invalid_params
video_too_large
unsupported_video_format
privacy_level_invalid
spam_risk_too_high
user_banned_from_posting
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
attempt 1 -> ~5s
attempt 2 -> ~10s
attempt 3 -> ~20s
attempt 4 -> ~40s
attempt 5 -> ~80s
attempt 6 -> ~160s
attempt 7+ -> cap around 5 minutes
```

---

# Worker Design

## Main Worker Loop

```ts
async function processTikTokJob(jobId: string) {
  const job = await db.jobs.find(jobId);

  if (!job) return;

  if (job.status === "Cancelled") return;
  if (job.status === "Published") return;
  if (job.status === "Failed") return;

  try {
    if (!job.platformPublishId) {
      await initializeTikTokPublish(job);
      return;
    }

    if (job.status === "Uploading") {
      await uploadVideo(job);
      return;
    }

    if (job.status === "Processing") {
      await checkTikTokStatus(job);
      return;
    }

    if (job.status === "ReconnectRequired") {
      return;
    }
  } catch (error) {
    await handleJobError(job, error);
  }
}
```

---

# Step 1: Initialize TikTok Publish

```ts
async function initializeTikTokPublish(job: SocialPublishJob) {
  await updateJob(job.id, {
    status: "Initializing"
  });

  const token = await getValidTikTokToken(job.userId);

  const response = await tiktok.initVideoPublish({
    accessToken: token.accessToken,
    title: job.title,
    description: job.description,
    privacyLevel: job.privacyLevel,
    source: "FILE_UPLOAD",
    videoSize: await getVideoSize(job.localVideoStorageKey)
  });

  await updateJob(job.id, {
    status: "Uploading",
    platformPublishId: response.publish_id,
    uploadUrl: response.upload_url
  });

  await enqueueJob(job.id);
}
```

Important:

```txt
If platformPublishId already exists, do not call init again.
```

Otherwise you may create duplicate TikTok publish attempts.

---

# Step 2: Upload Video

```ts
async function uploadVideo(job: SocialPublishJob) {
  if (!job.uploadUrl) {
    throw new RetryableError("missing_upload_url");
  }

  const video = await storage.openRead(job.localVideoStorageKey);

  await tiktok.uploadVideo({
    uploadUrl: job.uploadUrl,
    file: video,
    contentType: "video/mp4"
  });

  await updateJob(job.id, {
    status: "Processing"
  });

  await enqueueJob(job.id, {
    delaySeconds: 10
  });
}
```

---

# Upload Failure Handling

## If upload fails before TikTok receives the file

Retry upload using the same `uploadUrl`.

```txt
Uploading
  ↓ network error
Retrying
  ↓ retry upload
Uploading
```

---

## If upload result is unknown

Example:

```txt
request timeout after sending bytes
connection dropped after upload
```

Do **not** immediately upload again.

First move to `Processing` and poll TikTok status.

```ts
if (error.uploadMayHaveSucceeded) {
  await updateJob(job.id, {
    status: "Processing",
    lastNetworkError: error.message
  });

  await enqueueJob(job.id, {
    delaySeconds: 15
  });

  return;
}
```

Reason:

```txt
The upload may have reached TikTok even if your app did not receive the response.
```

---

## If upload URL becomes invalid

Do not blindly create a new TikTok init.

Safer order:

```txt
1. Poll status by platformPublishId
2. If TikTok says upload not found / expired / invalid
3. Mark job as Failed or create a new replacement job intentionally
```

Avoid automatic re-init unless you are sure the previous attempt cannot publish.

---

# Step 3: Poll TikTok Status

```ts
async function checkTikTokStatus(job: SocialPublishJob) {
  const token = await getValidTikTokToken(job.userId);

  const result = await tiktok.fetchPublishStatus({
    accessToken: token.accessToken,
    publishId: job.platformPublishId
  });

  await updateJob(job.id, {
    lastStatusCheckedAt: new Date().toISOString()
  });

  if (result.status === "PUBLISH_COMPLETE") {
    await updateJob(job.id, {
      status: "Published",
      platformPostId: result.post_id,
      publishedAt: new Date().toISOString()
    });

    return;
  }

  if (result.status === "FAILED") {
    await updateJob(job.id, {
      status: "Failed",
      lastErrorCode: result.error_code,
      lastErrorMessage: result.error_message
    });

    return;
  }

  await enqueueJob(job.id, {
    delaySeconds: 15
  });
}
```

---

# Polling Failure Handling

If status polling fails because of network error:

```ts
await updateJob(job.id, {
  status: "Processing",
  lastNetworkError: error.message,
  nextAttemptAt: nextRetryTime()
});
```

Do not show user:

```txt
Failed
```

Show:

```txt
Still checking TikTok status...
```

---

# Webhook Fallback

Use both:

```txt
Primary: webhook
Fallback: polling
```

Best flow:

```txt
TikTok webhook received
  ↓
update job immediately

Polling worker
  ↓
continues checking if webhook is delayed/missed
```

Webhook handler should be idempotent:

```ts
async function handleTikTokWebhook(event) {
  const job = await db.jobs.findByPlatformPublishId(event.publish_id);

  if (!job) return;

  if (job.status === "Published") return;
  if (job.status === "Cancelled") return;

  if (event.status === "PUBLISH_COMPLETE") {
    await updateJob(job.id, {
      status: "Published",
      platformPostId: event.post_id,
      publishedAt: new Date().toISOString()
    });
  }

  if (event.status === "FAILED") {
    await updateJob(job.id, {
      status: "Failed",
      lastErrorCode: event.error_code,
      lastErrorMessage: event.error_message
    });
  }
}
```

---

# Reconnect Flow

## When auth fails

Set:

```ts
status = "ReconnectRequired";
reconnectRequiredReason = "TikTok authorization expired or permission was revoked.";
```

Frontend shows:

```txt
TikTok connection expired. Reconnect to continue publishing.
```

Button:

```txt
Reconnect TikTok
```

---

## After user reconnects

Do not create a new job.

Resume existing job.

```ts
async function resumeAfterReconnect(jobId: string) {
  const job = await db.jobs.find(jobId);

  if (job.status !== "ReconnectRequired") return;

  if (job.platformPublishId) {
    await updateJob(job.id, {
      status: "Processing"
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
If platformPublishId exists -> poll TikTok status
If platformPublishId does not exist -> start init again
```

---

# SSE Reconnect Handling

SSE is only for frontend UX.

The backend worker must not depend on the browser staying connected.

---

## SSE Endpoint

```http
GET /api/social-posts/jobs/{jobId}/events
```

Send events:

```txt
event: status
id: 12
data: {"status":"Uploading"}

event: status
id: 13
data: {"status":"Processing"}

event: status
id: 14
data: {"status":"Published","platformPostId":"7350000000000000000"}
```

---

## Client SSE Reconnect

```ts
function watchPublishJob(jobId: string) {
  let retryCount = 0;

  function connect() {
    const events = new EventSource(`/api/social-posts/jobs/${jobId}/events`);

    events.addEventListener("status", (event) => {
      retryCount = 0;

      const data = JSON.parse(event.data);

      setStatus(data.status);

      if (data.status === "Published") {
        setTikTokPostId(data.platformPostId);
        events.close();
      }

      if (data.status === "Failed") {
        setError(data.lastErrorMessage);
        events.close();
      }

      if (data.status === "ReconnectRequired") {
        showReconnectTikTokButton();
        events.close();
      }
    });

    events.onerror = () => {
      events.close();

      retryCount++;

      const delay = Math.min(30000, 1000 * 2 ** retryCount);

      setTimeout(connect, delay);
    };
  }

  connect();
}
```

---

## SSE Fallback to Polling

If SSE keeps failing, fallback to polling.

```ts
async function fallbackPoll(jobId: string) {
  const interval = setInterval(async () => {
    const res = await fetch(`/api/social-posts/jobs/${jobId}`);
    const job = await res.json();

    setStatus(job.status);

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

Recommended frontend behavior:

```txt
Try SSE
  ↓ if SSE fails repeatedly
Fallback to polling
```

---

# User-Facing Messages

## Processing

```txt
TikTok is processing your video. This may take a while.
```

## Network issue

```txt
We are having trouble checking TikTok right now. Your upload is still safe.
```

## Reconnect required

```txt
Your TikTok connection expired. Please reconnect TikTok to continue.
```

## Failed because of video

```txt
TikTok rejected this video. Please check the file format, size, and posting settings.
```

## Published

```txt
Your video was published successfully.
```

---

# Recovery Jobs

Run scheduled recovery every few minutes.

```ts
async function recoverStuckJobs() {
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

Purpose:

```txt
worker crashed
server restarted
queue message lost
network failed
webhook missed
browser disconnected
```

---

# Idempotency

## API idempotency key

When frontend starts publish:

```http
POST /api/social-posts/tiktok
Idempotency-Key: user_123_video_456_tiktok
```

If same key is sent again, return existing job:

```json
{
  "jobId": "job_123",
  "status": "Processing"
}
```

---

## Database unique constraint

```txt
unique(userId, videoId, platform, idempotencyKey)
```

Optional stronger rule:

```txt
Only one active TikTok publish job per video.
```

Active statuses:

```txt
Created
Initializing
Uploading
Processing
Retrying
ReconnectRequired
```

---

# Queue Pattern

Recommended:

```txt
API creates job
API saves outbox message
Worker reads outbox
Worker processes publish
```

This prevents:

```txt
job saved but worker not triggered
worker triggered but job not saved
```

---

# Minimal Outbox Table

```ts
type OutboxMessage = {
  id: string;
  type: "ProcessTikTokPublishJob";
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

# Final Recommended Behavior

## Backend

```txt
Return jobId immediately
Store publish_id when TikTok init succeeds
Retry network errors
Require reconnect on auth errors
Poll status until final state
Accept webhook as faster signal
Run recovery job for stuck jobs
```

## Frontend

```txt
Show live status
Use SSE first
Reconnect SSE automatically
Fallback to polling
Show reconnect TikTok button if needed
Never show Failed for temporary network issues
```

---

# Final State Machine

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


Any temporary error:
  ↓
Retrying
  ↓
resume previous step


Auth issue:
  ↓
ReconnectRequired
  ↓ user reconnects
  ↓ resume existing job


Permanent provider/user error:
  ↓
Failed


User cancels:
  ↓
Cancelled
```

---

# Production Checklist

```txt
[ ] Store internal job ID
[ ] Store TikTok publish_id
[ ] Store TikTok post_id later
[ ] Add idempotency key
[ ] Add retry count
[ ] Add nextAttemptAt
[ ] Add last provider error code
[ ] Add last provider log ID
[ ] Add token refresh logic
[ ] Add reconnect flow
[ ] Add SSE endpoint
[ ] Add polling fallback
[ ] Add stuck-job recovery
[ ] Add webhook handler
[ ] Add duplicate publish protection
[ ] Keep original video until final state
```

---

# Best Simple Version

If you want the simplest safe version first:

```txt
1. Create job
2. TikTok init
3. Upload
4. Save publish_id
5. Poll every 15 seconds
6. Retry network errors
7. Mark ReconnectRequired on auth errors
8. Save post_id when available
9. Frontend polls your job endpoint
```

Add SSE and webhooks later.
