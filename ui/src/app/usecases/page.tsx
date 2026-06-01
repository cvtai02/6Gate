"use client";

import { useEffect, useMemo, useState } from "react";

type UseCaseKey = "path" | "stream";

type Group = {
  id: string;
  name: string;
  destinations: { destinationId: string; name: string | null; type: string | null }[];
};

type UploadJob = {
  id: string;
  destinationId: string;
  destinationName: string;
  destinationIcon?: string | null;
  platform: string;
  jobDetailsLink?: string;
  jobEventsLink?: string;
  jobCancelLink?: string;
  status?: string;
  providerPostUrl?: string | null;
  errorMessage?: string | null;
};

const TERMINAL_STATUSES = new Set(["Published", "Failed", "Cancelled", "ReconnectRequired"]);
const CANCELLABLE_STATUSES = ["Created", "Initializing", "Uploading", "Finishing", "Processing", "Retrying", "ReconnectRequired"] as const;

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

function pathInstructions(baseUrl: string) {
  return `# 6Gate API instructions: upload to a group by path

Use this when an agent has an absolute video file path on the same machine that runs 6Gate.

Base URL: ${baseUrl}

## 1. List groups

\`\`\`http
GET /api/groups
\`\`\`

\`\`\`bash
curl ${baseUrl}/api/groups
\`\`\`

Choose the target group's \`id\`. A group must have at least one destination.

## 2. Enqueue the group upload

\`\`\`http
POST /api/groups/{groupId}/upload-by-path
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
      "destinationIcon": "${baseUrl}/icons/youtube.svg",
      "platform": "youtube",
      "jobDetailsLink": "${baseUrl}/jobs/job_Kp2mNx4qRs",
      "jobEventsLink": "${baseUrl}/api/post-jobs/job_Kp2mNx4qRs/events",
      "jobCancelLink": "${baseUrl}/api/post-jobs/job_Kp2mNx4qRs/cancel"
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
`;
}

function streamInstructions(baseUrl: string) {
  return `# 6Gate API instructions: upload to a group by stream

Base URL: ${baseUrl}

Status: not implemented.

There is currently no stream-upload endpoint for uploading to a group from an incoming byte stream.

Use the implemented path-based flow instead:

\`\`\`http
POST /api/groups/{groupId}/upload-by-path
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

A future stream API should accept video bytes, persist them to a server-readable file or object store, then create the same destination jobs currently created by \`/api/groups/{groupId}/upload-by-path\`.

Useful existing endpoints:
- \`GET /api/groups\`: list groups and destination memberships.
- \`POST /api/groups/{groupId}/upload-by-path\`: upload by server-local path.
- \`GET /api/post-jobs/{jobId}/events\`: monitor each job with its own server-sent events stream.
- \`GET /api/post-jobs/{jobId}\`: poll one job.
`;
}

export default function UseCasesPage() {
  const [activeUseCase, setActiveUseCase] = useState<UseCaseKey>("path");
  const [groups, setGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [groupId, setGroupId] = useState("");
  const [videoPath, setVideoPath] = useState("");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [privacy, setPrivacy] = useState<"public" | "private" | "unlisted">("public");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [jobs, setJobs] = useState<UploadJob[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadGroups() {
      setLoadingGroups(true);
      try {
        const res = await fetch("/api/groups");
        const data = (await res.json()) as Group[];
        if (cancelled) return;
        setGroups(data);
        setGroupId((current) => current || data[0]?.id || "");
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load groups");
      } finally {
        if (!cancelled) setLoadingGroups(false);
      }
    }

    loadGroups();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (jobs.length === 0) return;
    const pending = jobs.filter((job) => !TERMINAL_STATUSES.has(job.status ?? "Created"));
    if (pending.length === 0) return;

    const timer = window.setInterval(async () => {
      const nextJobs = await Promise.all(
        jobs.map(async (job) => {
          if (TERMINAL_STATUSES.has(job.status ?? "")) return job;
          try {
            const res = await fetch(`/api/post-jobs/${job.id}`);
            if (!res.ok) return job;
            const data = await res.json();
            return {
              ...job,
              status: data.status,
              providerPostUrl: data.providerPostUrl ?? null,
              errorMessage: data.errorMessage ?? null,
            };
          } catch {
            return job;
          }
        })
      );
      setJobs(nextJobs);
    }, 2500);

    return () => window.clearInterval(timer);
  }, [jobs]);

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === groupId),
    [groups, groupId]
  );

  function handleDownloadInstructions(useCase: UseCaseKey) {
    const baseUrl = window.location.origin;
    if (useCase === "path") {
      downloadMarkdown("6gate-upload-to-group-by-path.md", pathInstructions(baseUrl));
      return;
    }
    downloadMarkdown("6gate-upload-to-group-by-stream.md", streamInstructions(baseUrl));
  }

  async function handlePathUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!groupId || !videoPath.trim()) return;

    setSubmitting(true);
    setError("");
    setJobs([]);

    try {
      const res = await fetch(`/api/groups/${groupId}/upload-by-path`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoPath: videoPath.trim(),
          title: title.trim() || undefined,
          caption: caption.trim() || undefined,
          privacy,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Upload failed");
        return;
      }

      setJobs(
        (data.jobs ?? []).map((job: UploadJob) => ({
          ...job,
          status: "Created",
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-full">
      <aside className="w-72 shrink-0 border-r border-[var(--border)] bg-black/20 px-4 py-6">
        <p className="px-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Use cases</p>
        <nav className="mt-3 space-y-1">
          <button
            type="button"
            onClick={() => setActiveUseCase("path")}
            className={`w-full rounded-lg px-3 py-3 text-left transition-colors ${
              activeUseCase === "path"
                ? "bg-indigo-600/20 text-white"
                : "text-gray-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <span className="block text-sm font-medium">Upload to a group by path</span>
            <span className="mt-0.5 block text-xs text-gray-500">Post a local file path to every destination</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveUseCase("stream")}
            className={`w-full rounded-lg px-3 py-3 text-left transition-colors ${
              activeUseCase === "stream"
                ? "bg-indigo-600/20 text-white"
                : "text-gray-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <span className="block text-sm font-medium">Upload to a group by stream</span>
            <span className="mt-0.5 block text-xs text-gray-500">Not implemented</span>
          </button>
        </nav>
      </aside>

      <main className="flex-1 p-8">
        <div className="mb-7">
          <h1 className="text-2xl font-bold text-white">Use Cases</h1>
          <p className="mt-1 text-sm text-gray-500">Run common integration flows from one place.</p>
        </div>

        {activeUseCase === "path" ? (
          <section className="max-w-4xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Upload to a group by path</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Enqueue one background publish job per destination in the selected group.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDownloadInstructions("path")}
                className="shrink-0 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-indigo-500/60 hover:text-white"
              >
                Download instructions
              </button>
            </div>

            <form onSubmit={handlePathUpload} className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-6">
              {error && (
                <p className="mb-5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  {error}
                </p>
              )}

              <div className="grid gap-5">
                <div>
                  <label className="mb-1.5 block text-xs text-gray-400">Group</label>
                  <select
                    value={groupId}
                    onChange={(event) => setGroupId(event.target.value)}
                    disabled={loadingGroups || groups.length === 0}
                    className="w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-indigo-500 disabled:opacity-50"
                  >
                    {loadingGroups ? (
                      <option>Loading groups...</option>
                    ) : groups.length === 0 ? (
                      <option>No groups available</option>
                    ) : (
                      groups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))
                    )}
                  </select>
                  {selectedGroup && (
                    <p className="mt-1.5 text-xs text-gray-600">
                      {selectedGroup.destinations.length} destination{selectedGroup.destinations.length === 1 ? "" : "s"} in this group
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs text-gray-400">Video path</label>
                  <input
                    required
                    value={videoPath}
                    onChange={(event) => setVideoPath(event.target.value)}
                    placeholder="C:/Users/you/Videos/clip.mp4"
                    className="w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-gray-700 focus:border-indigo-500"
                  />
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs text-gray-400">Title</label>
                    <input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="Optional title"
                      className="w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-gray-700 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-gray-400">Privacy</label>
                    <select
                      value={privacy}
                      onChange={(event) => setPrivacy(event.target.value as "public" | "private" | "unlisted")}
                      className="w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-indigo-500"
                    >
                      <option value="public">Public</option>
                      <option value="unlisted">Unlisted</option>
                      <option value="private">Private</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs text-gray-400">Caption</label>
                  <textarea
                    value={caption}
                    onChange={(event) => setCaption(event.target.value)}
                    placeholder="Optional caption or description"
                    rows={4}
                    className="w-full resize-none rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-gray-700 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="submit"
                  disabled={submitting || loadingGroups || groups.length === 0}
                  className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? "Uploading..." : "Upload by path"}
                </button>
              </div>
            </form>

            {jobs.length > 0 && (
              <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--muted)]">
                <div className="border-b border-[var(--border)] px-5 py-4">
                  <h3 className="text-sm font-semibold text-white">Created jobs</h3>
                </div>
                <div className="divide-y divide-[var(--border)]">
                  {jobs.map((job) => (
                    <div key={job.id} className="flex items-center gap-4 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {job.destinationIcon && (
                            <img
                              src={job.destinationIcon}
                              alt=""
                              className="h-5 w-5 rounded bg-white object-contain p-0.5"
                            />
                          )}
                          <p className="truncate text-sm text-white">{job.destinationName}</p>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-gray-500">{job.platform} / {job.id}</p>
                        {job.errorMessage && <p className="mt-1 text-xs text-red-400">{job.errorMessage}</p>}
                      </div>
                      <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs text-gray-300">
                        {job.status ?? "Created"}
                      </span>
                      {job.providerPostUrl && (
                        <a
                          href={job.providerPostUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-indigo-400 hover:text-indigo-300"
                        >
                          View
                        </a>
                      )}
                      {job.jobDetailsLink && (
                        <a
                          href={job.jobDetailsLink}
                          className="text-xs text-indigo-400 hover:text-indigo-300"
                        >
                          Details
                        </a>
                      )}
                      {job.jobEventsLink && (
                        <a
                          href={job.jobEventsLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-indigo-400 hover:text-indigo-300"
                        >
                          Stream
                        </a>
                      )}
                      {(CANCELLABLE_STATUSES as readonly string[]).includes(job.status ?? "Created") && (
                        <button
                          type="button"
                          onClick={async () => {
                            await fetch(job.jobCancelLink ?? `/api/post-jobs/${job.id}/cancel`, { method: "POST" });
                            setJobs((current) =>
                              current.map((item) =>
                                item.id === job.id ? { ...item, status: "Cancelled", errorMessage: null } : item
                              )
                            );
                          }}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        ) : (
          <section className="max-w-3xl rounded-xl border border-[var(--border)] bg-[var(--muted)] p-10 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-black/30">
              <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white">Upload to a group by stream</h2>
            <p className="mt-2 text-sm text-gray-500">This use case is not implemented yet.</p>
            <button
              type="button"
              onClick={() => handleDownloadInstructions("stream")}
              className="mt-6 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-indigo-500/60 hover:text-white"
            >
              Download instructions
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
