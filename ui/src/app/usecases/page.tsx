"use client";

import { useState } from "react";

type UseCaseKey = "path" | "queue";

const BASE_URL_DEV = "http://localhost:20130";
const BASE_URL_PROD = "https://6gate-api.minfect.com";

const USE_CASES: { key: UseCaseKey; title: string; subtitle: string; markdown: string }[] = [
  {
    key: "path",
    title: "Upload immediately to a group",
    subtitle: "Post a local file path — jobs start immediately, one per destination",
    markdown: `# 6Gate API instructions: upload to a group

Use this when an agent has an absolute video file path on the same machine that runs 6Gate. The upload starts immediately — jobs are created and dispatched as soon as you call the endpoint.

Base URL (dev):  ${BASE_URL_DEV}
Base URL (prod): ${BASE_URL_PROD}

## 1. Enqueue the group upload

\`\`\`http
POST /api/groups/{groupId}/upload
Content-Type: application/json
\`\`\`

\`\`\`json
{
  "videoPath": "C:/Users/you/Videos/clip.mp4",
  "title": "Optional title",
  "caption": "Optional caption or description",
  "privacy": "public"
}
\`\`\`

Fields:
- \`videoPath\`: required absolute path readable by the 6Gate server process.
- \`title\`: optional.
- \`caption\`: optional.
- \`privacy\`: optional, one of \`public\`, \`unlisted\`, or \`private\`.

Successful response:

\`\`\`json
{
  "groupId": "group_Ab3Xy7Zq",
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

Each job uploads to one destination. Keep the source file in place until all jobs finish.

## 3. Monitor each job with its own stream

Open one EventSource per returned job using \`jobEventsLink\`.

\`\`\`http
GET /api/post-jobs/{jobId}/events
Accept: text/event-stream
\`\`\`

\`\`\`js
for (const job of jobs) {
  const es = new EventSource(job.jobEventsLink);

  es.addEventListener("log", (event) => {
    const log = JSON.parse(event.data);
    console.log(job.id, log.level, log.message);
  });

  es.addEventListener("status", (event) => {
    const status = JSON.parse(event.data);
    console.log(job.id, status.status);

    if (["Published", "Failed", "Cancelled"].includes(status.status)) {
      es.close();
    }
  });
}
\`\`\`

Polling fallback:

\`\`\`http
GET /api/post-jobs/{jobId}
\`\`\`

Terminal statuses are \`Published\`, \`Failed\`, and \`Cancelled\`. Treat \`ReconnectRequired\` as needing user action.

## 4. Retry failed jobs

\`\`\`http
POST /api/post-jobs/{jobId}/retry
\`\`\`

## 5. Cancel queued or active jobs

\`\`\`http
POST /api/post-jobs/{jobId}/cancel
\`\`\`
`,
  },
  {
    key: "queue",
    title: "Schedule uploads with a group queue",
    subtitle: "Enqueue videos and let the scheduler dispatch one per day",
    markdown: `# 6Gate API instructions: schedule uploads with a group queue

Each group has a built-in upload queue. Add items to it and the scheduler automatically dispatches the oldest pending item once per day at the group's configured time.

Base URL (dev):  ${BASE_URL_DEV}
Base URL (prod): ${BASE_URL_PROD}

## 1. Check when the next upload will fire

\`\`\`http
GET /api/groups/{groupId}/next-upload-time
\`\`\`

Response:

\`\`\`json
{
  "groupId": "grp_abc123",
  "uploadTimeInDay": "09:00",
  "pendingCount": 3,
  "nextUploadAt": "2026-06-03T09:00:00.000Z"
}
\`\`\`

- \`nextUploadAt\` is \`null\` when the queue has no pending items — nothing will fire.
- If \`nextUploadAt\` is in the past, the scheduler will dispatch within 30 seconds.
- The upload time is configured by a moderator via \`PATCH /api/groups/{groupId}/queue-settings\`.

## 2. Add an item to the queue

\`\`\`http
POST /api/groups/{groupId}/queue
Content-Type: application/json
\`\`\`

\`\`\`json
{
  "storagePath": "CloudflareR2/account/bucket/videos/clip.mp4",
  "title": "Optional title",
  "caption": "Optional caption or description",
  "privacy": "public"
}
\`\`\`

Fields:
- \`storagePath\`: required. 7router absolute path to the video in cloud storage.
- \`title\`, \`caption\`, \`privacy\`: optional metadata passed through to the upload job.

Response (201):

\`\`\`json
{
  "id": "gqueue_Kp2mNx4qRs",
  "groupId": "grp_abc123",
  "videoPath": "CloudflareR2/account/bucket/videos/clip.mp4",
  "title": null,
  "caption": null,
  "privacy": "public",
  "status": "Pending",
  "uploadBatchId": null,
  "errorMessage": null,
  "createdAt": "...",
  "updatedAt": "...",
  "queueLink": "http://localhost:20130/groups/grp_abc123/queue"
}
\`\`\`

Open \`queueLink\` in a browser to view and manage the queue for this group.

## 3. List the queue

\`\`\`http
GET /api/groups/{groupId}/queue
\`\`\`

Returns all items ordered by newest first. Filter by \`status\` client-side: \`Pending\`, \`Dispatched\`, \`Failed\`.

## 4. Remove a pending item

\`\`\`http
DELETE /api/groups/{groupId}/queue/{itemId}
\`\`\`

Returns 204. Use this to cancel an item before it is dispatched.

## 5. Monitor the dispatched jobs

When the scheduler dispatches an item it creates standard post-jobs (one per group destination). Poll or stream them the same way as a direct upload:

\`\`\`http
GET /api/post-jobs/{jobId}/events
Accept: text/event-stream
\`\`\`

\`\`\`http
GET /api/post-jobs/{jobId}
\`\`\`

Terminal statuses: \`Published\`, \`Failed\`, \`Cancelled\`.
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
  const [activeKey, setActiveKey] = useState<UseCaseKey>("path");
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
