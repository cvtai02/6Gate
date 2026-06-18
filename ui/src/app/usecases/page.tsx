"use client";

import { useState } from "react";

type UseCaseKey = "immediate" | "schedule";

const BASE_URL_DEV = "http://localhost:20130";
const BASE_URL_PROD = "https://6gate-api.minfect.com";

const USE_CASES: { key: UseCaseKey; title: string; subtitle: string; markdown: string }[] = [
  {
    key: "immediate",
    title: "Immediate upload",
    subtitle: "Publish a video to all group destinations now",
    markdown: `# Immediate upload for a group

Base URL (dev):  ${BASE_URL_DEV}
Base URL (prod): ${BASE_URL_PROD}

---

## Upload via URL

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

\`videoUrl\` can be a CDN link or any public URL.

---

## Response

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

## Monitor jobs (SSE)

\`\`\`http
GET /api/post-jobs/{jobId}/events
Accept: text/event-stream
\`\`\`

\`\`\`js
const es = new EventSource(job.jobEventsLink);
es.addEventListener("status", (e) => {
  const { status } = JSON.parse(e.data);
  if (["Published", "Failed", "Cancelled"].includes(status)) es.close();
});
\`\`\`

**Polling fallback:** \`GET /api/post-jobs/{jobId}\`

Terminal statuses: \`Published\`, \`Failed\`, \`Cancelled\`, \`ReconnectRequired\`.

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
    title: "Scheduled upload",
    subtitle: "Queue a video for the group's next scheduled time",
    markdown: `# Scheduled upload for a group

Base URL (dev):  ${BASE_URL_DEV}
Base URL (prod): ${BASE_URL_PROD}

---

## Check next upload time

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

\`nextUploadAt\` is \`null\` when the queue is empty.

---

## Queue via URL

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

## Response (201)

\`\`\`json
{
  "id": "gqueue_Kp2mNx4qRs",
  "groupId": "grp_abc123",
  "videoPath": "...",
  "title": "My Video",
  "status": "Pending",
  "uploadBatchId": null,
  "createdAt": "...",
  "queueLink": "{baseUrl}/groups/grp_abc123/queue"
}
\`\`\`

---

## Manage queue

**List:** \`GET /api/groups/{groupId}/queue\`
**Remove:** \`DELETE /api/groups/{groupId}/queue/{itemId}\`

---

## Configure schedule

\`\`\`http
PATCH /api/groups/{groupId}/queue-settings
Content-Type: application/json
\`\`\`

\`\`\`json
{
  "uploadTimesInDay": ["09:00", "18:00"]
}
\`\`\`

Times in \`HH:mm\` local format. One queue item dispatches per slot per day.

---

## Monitor dispatched jobs

Same as immediate upload — use SSE or polling on \`/api/post-jobs/{jobId}\`.

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
      <aside className="w-56 shrink-0 border-r border-[var(--border)] bg-black/20 px-3 py-5">
        <p className="px-3 text-[11px] font-semibold uppercase tracking-wide text-gray-600">Use cases</p>
        <nav className="mt-2 space-y-0.5">
          {USE_CASES.map((uc) => (
            <button
              key={uc.key}
              type="button"
              onClick={() => setActiveKey(uc.key)}
              className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${
                activeKey === uc.key
                  ? "bg-indigo-600/20 text-white"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="block text-sm font-medium">{uc.title}</span>
              <span className="block text-[11px] text-gray-500">{uc.subtitle}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 flex flex-col min-h-full">
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-[var(--border)]">
          <h1 className="text-sm font-semibold text-white">{active.title}</h1>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-gray-400 transition-colors hover:border-indigo-500/40 hover:text-white"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-gray-400 transition-colors hover:border-indigo-500/40 hover:text-white"
            >
              Download .md
            </button>
          </div>
        </div>

        <pre className="flex-1 overflow-auto px-6 py-5 text-xs text-gray-300 font-mono leading-relaxed whitespace-pre-wrap">
          {active.markdown}
        </pre>
      </main>
    </div>
  );
}
