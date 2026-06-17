"use client";

import { useState } from "react";

type UseCaseKey = "immediate" | "schedule";

const BASE_URL_DEV = "http://localhost:20130";
const BASE_URL_PROD = "https://6gate-api.minfect.com";

const USE_CASES: { key: UseCaseKey; title: string; subtitle: string; markdown: string }[] = [
  {
    key: "immediate",
    title: "Immediate upload for a group",
    subtitle: "Upload a video to all group destinations right now",
    markdown: `# 6Gate API: Immediate upload for a group

Upload a video to all destinations in a group immediately. Three input methods are supported: direct file upload, CDN/public URL, or 7router storage path.

Base URL (dev):  ${BASE_URL_DEV}
Base URL (prod): ${BASE_URL_PROD}

---

## Option A: Upload a file (multipart)

Use when the client has the video file bytes.

\`\`\`http
POST /api/groups/{groupId}/upload-file
Content-Type: multipart/form-data
\`\`\`

Multipart fields:
- \`file\` (required): the video file.
- \`title\` (optional): video title.
- \`caption\` (optional): description or caption.
- \`privacy\` (optional): \`public\`, \`unlisted\`, or \`private\`. Defaults to platform default.

\`\`\`js
const form = new FormData();
form.set("file", fileInput.files[0]);
form.set("title", "My Video");
form.set("caption", "Check this out");
form.set("privacy", "public");

const res = await fetch("/api/groups/{groupId}/upload-file", {
  method: "POST",
  body: form,
});
const data = await res.json();
\`\`\`

---

## Option B: CDN / public URL

Use when the video is hosted on a CDN or any publicly accessible URL.

\`\`\`http
POST /api/groups/{groupId}/upload
Content-Type: application/json
\`\`\`

\`\`\`json
{
  "videoUrl": "https://cdn.example.com/videos/clip.mp4",
  "title": "My Video",
  "caption": "Check this out",
  "privacy": "public"
}
\`\`\`

The backend downloads the video from the URL, then publishes to all destinations.

---

## Option C: 7router storage path

Use when the video exists in connected cloud storage (R2, S3, etc.) via 7router.

\`\`\`http
POST /api/groups/{groupId}/upload
Content-Type: application/json
\`\`\`

\`\`\`json
{
  "absolutePath": "CloudflareR2/account/bucket/videos/clip.mp4",
  "title": "My Video",
  "caption": "Check this out",
  "privacy": "public"
}
\`\`\`

The backend downloads the video from 7router, then publishes to all destinations.

---

## Response (all options)

\`\`\`json
{
  "groupId": "group_Ab3Xy7Zq",
  "uploadBatchId": "batch_Kp2mNx4qRs",
  "jobs": [
    {
      "id": "job_Kp2mNx4qRs",
      "destinationId": "dest_Yz9wQv1b",
      "destinationName": "My Channel",
      "destinationIcon": "{baseUrl}/icons/youtube.svg",
      "platform": "youtube",
      "jobDetailsLink": "{baseUrl}/jobs/job_Kp2mNx4qRs",
      "jobEventsLink": "{baseUrl}/api/post-jobs/job_Kp2mNx4qRs/events",
      "jobCancelLink": "{baseUrl}/api/post-jobs/job_Kp2mNx4qRs/cancel"
    }
  ]
}
\`\`\`

Each job uploads to one destination. All jobs in a batch share the same \`uploadBatchId\`.

---

## Monitor jobs

**Server-Sent Events (preferred):**

\`\`\`http
GET /api/post-jobs/{jobId}/events
Accept: text/event-stream
\`\`\`

\`\`\`js
for (const job of data.jobs) {
  const es = new EventSource(job.jobEventsLink);

  es.addEventListener("status", (event) => {
    const { status } = JSON.parse(event.data);
    console.log(job.id, status);
    if (["Published", "Failed", "Cancelled"].includes(status)) es.close();
  });

  es.addEventListener("log", (event) => {
    const { level, message } = JSON.parse(event.data);
    console.log(job.id, level, message);
  });
}
\`\`\`

**Polling fallback:**

\`\`\`http
GET /api/post-jobs/{jobId}
\`\`\`

Terminal statuses: \`Published\`, \`Failed\`, \`Cancelled\`. Treat \`ReconnectRequired\` as needing user action.

---

## Retry / Cancel

\`\`\`http
POST /api/post-jobs/{jobId}/retry
POST /api/post-jobs/{jobId}/cancel
\`\`\`
`,
  },
  {
    key: "schedule",
    title: "Schedule for a group",
    subtitle: "Queue a video for automatic dispatch at the group's scheduled time",
    markdown: `# 6Gate API: Schedule for a group

Queue a video to be published later at the group's configured daily upload time(s). Three input methods are supported: direct file upload, CDN/public URL, or 7router storage path.

Base URL (dev):  ${BASE_URL_DEV}
Base URL (prod): ${BASE_URL_PROD}

---

## Check when the next upload will fire

\`\`\`http
GET /api/groups/{groupId}/next-upload-time
\`\`\`

\`\`\`json
{
  "groupId": "grp_abc123",
  "uploadTimeInDay": "09:00",
  "pendingCount": 3,
  "nextUploadAt": "2026-06-03T09:00:00.000Z"
}
\`\`\`

- \`nextUploadAt\` is \`null\` when the queue is empty.
- Upload times are configured via \`PATCH /api/groups/{groupId}/queue-settings\`.

---

## Option A: Queue a file (multipart)

Use when the client has the video file bytes. The backend stores it and dispatches later.

\`\`\`http
POST /api/groups/{groupId}/queue-file
Content-Type: multipart/form-data
\`\`\`

Multipart fields:
- \`file\` (required): the video file.
- \`title\` (optional): video title.
- \`caption\` (optional): description or caption.
- \`privacy\` (optional): \`public\`, \`unlisted\`, or \`private\`.

\`\`\`js
const form = new FormData();
form.set("file", fileInput.files[0]);
form.set("title", "My Video");
form.set("privacy", "public");

const res = await fetch("/api/groups/{groupId}/queue-file", {
  method: "POST",
  body: form,
});
const item = await res.json();
\`\`\`

---

## Option B: Queue a CDN / public URL

Use when the video is hosted on a CDN. The backend downloads it at dispatch time.

\`\`\`http
POST /api/groups/{groupId}/queue
Content-Type: application/json
\`\`\`

\`\`\`json
{
  "videoUrl": "https://cdn.example.com/videos/clip.mp4",
  "title": "My Video",
  "caption": "Check this out",
  "privacy": "public"
}
\`\`\`

---

## Option C: Queue a 7router storage path

Use when the video exists in connected cloud storage via 7router.

\`\`\`http
POST /api/groups/{groupId}/queue
Content-Type: application/json
\`\`\`

\`\`\`json
{
  "absolutePath": "CloudflareR2/account/bucket/videos/clip.mp4",
  "title": "My Video",
  "caption": "Check this out",
  "privacy": "public"
}
\`\`\`

---

## Response (all options, 201)

\`\`\`json
{
  "id": "gqueue_Kp2mNx4qRs",
  "groupId": "grp_abc123",
  "absolutePath": "...",
  "title": "My Video",
  "caption": "Check this out",
  "privacy": "public",
  "status": "Pending",
  "uploadBatchId": null,
  "errorMessage": null,
  "createdAt": "...",
  "updatedAt": "...",
  "queueLink": "{baseUrl}/groups/grp_abc123/queue"
}
\`\`\`

---

## Manage the queue

**List items:**
\`\`\`http
GET /api/groups/{groupId}/queue
\`\`\`

**Remove a pending item:**
\`\`\`http
DELETE /api/groups/{groupId}/queue/{itemId}
\`\`\`

---

## Configure schedule times

\`\`\`http
PATCH /api/groups/{groupId}/queue-settings
Content-Type: application/json
\`\`\`

\`\`\`json
{
  "uploadTimesInDay": ["09:00", "18:00"]
}
\`\`\`

Times are in local \`HH:mm\` format (API server timezone). One queue item dispatches per time slot per day.

---

## Monitor dispatched jobs

When the scheduler dispatches a queue item, it creates standard post-jobs (one per group destination):

\`\`\`http
GET /api/post-jobs/{jobId}/events
Accept: text/event-stream
\`\`\`

\`\`\`http
GET /api/post-jobs/{jobId}
\`\`\`

Terminal statuses: \`Published\`, \`Failed\`, \`Cancelled\`.

\`\`\`http
POST /api/post-jobs/{jobId}/retry
POST /api/post-jobs/{jobId}/cancel
\`\`\`
`,
  },
];

function downloadMarkdown(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export default function UseCasesPage() {
  const [activeKey, setActiveKey] = useState<UseCaseKey>("immediate");
  const [copied, setCopied] = useState(false);

  const active = USE_CASES.find((uc) => uc.key === activeKey)!;

  function handleCopy() {
    navigator.clipboard.writeText(active.markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    downloadMarkdown(`6gate-${active.key}.md`, active.markdown);
  }

  return (
    <div className="flex min-h-full">
      <aside className="w-72 shrink-0 border-r border-[var(--border)] bg-black/20 px-4 py-6">
        <p className="px-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Use cases</p>
        <nav className="mt-3 space-y-1">
          {USE_CASES.map((uc) => (
            <button
              key={uc.key}
              type="button"
              onClick={() => setActiveKey(uc.key)}
              className={`w-full rounded-lg px-3 py-3 text-left transition-colors ${
                activeKey === uc.key
                  ? "bg-indigo-600/20 text-white"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="block text-sm font-medium">{uc.title}</span>
              <span className="mt-0.5 block text-xs text-gray-500">{uc.subtitle}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 flex flex-col min-h-full">
        <div className="flex items-start justify-between gap-4 px-8 pt-8 pb-5 border-b border-[var(--border)]">
          <div>
            <h1 className="text-2xl font-bold text-white">{active.title}</h1>
            <p className="mt-1 text-sm text-gray-500">{active.subtitle}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-indigo-500/60 hover:text-white"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-indigo-500/60 hover:text-white"
            >
              Download .md
            </button>
          </div>
        </div>

        <pre className="flex-1 overflow-auto px-8 py-6 text-xs text-gray-300 font-mono leading-relaxed whitespace-pre-wrap">
          {active.markdown}
        </pre>
      </main>
    </div>
  );
}
