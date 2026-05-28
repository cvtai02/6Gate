type Method = "GET" | "POST" | "PATCH" | "DELETE";

type Endpoint = {
  method: Method;
  path: string;
  description: string;
  body?: string;
  notes?: string;
};

type Section = {
  title: string;
  description?: string;
  endpoints: Endpoint[];
};

const METHOD_STYLES: Record<Method, string> = {
  GET: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  POST: "bg-green-500/15 text-green-300 border-green-500/30",
  PATCH: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  DELETE: "bg-red-500/15 text-red-300 border-red-500/30",
};

const SECTIONS: Section[] = [
  {
    title: "Health",
    endpoints: [
      { method: "GET", path: "/api/health", description: "Liveness probe." },
    ],
  },
  {
    title: "Providers",
    description: "OAuth provider configurations (client id/secret, scopes).",
    endpoints: [
      { method: "GET", path: "/api/providers", description: "List all providers." },
      { method: "POST", path: "/api/providers", description: "Create a new provider.", body: `{ name, type, clientId?, clientSecret?, scopes? }` },
      { method: "GET", path: "/api/providers/:id", description: "Get one provider." },
      { method: "PATCH", path: "/api/providers/:id", description: "Update provider fields.", body: `{ name?, clientId?, clientSecret?, scopes? }` },
      { method: "DELETE", path: "/api/providers/:id", description: "Delete a provider." },
    ],
  },
  {
    title: "Accounts",
    description: "Connected social accounts (one per OAuth connection).",
    endpoints: [
      { method: "GET", path: "/api/accounts", description: "List accounts. Filter with ?type=youtube|tiktok|meta." },
      { method: "PATCH", path: "/api/accounts/:id", description: "Rename or update an account.", body: `{ displayName? }` },
      { method: "DELETE", path: "/api/accounts/:id", description: "Disconnect an account." },
      { method: "POST", path: "/api/accounts/:id/sync", description: "Refresh profile (name, avatar) from the provider.", notes: "TikTok only. Tries /v2/user/info/ then falls back to /v2/post/publish/creator_info/query/." },
      { method: "POST", path: "/api/accounts/:id/sync-destinations", description: "Re-fetch the destinations linked to this account.", notes: "Used for Meta to refresh page list." },
      { method: "POST", path: "/api/accounts/oauth/start", description: "Begin an OAuth flow. Returns { url } to redirect the user to.", body: `{ providerId }` },
      { method: "GET", path: "/api/accounts/oauth/callback", description: "OAuth redirect target. Exchanges code, creates account, then redirects to /providers/:type." },
      { method: "POST", path: "/api/accounts/meta/sync", description: "Sync Meta pages and Instagram accounts after a manual token paste." },
      { method: "POST", path: "/api/accounts/meta/manual-connect", description: "Connect Meta with a user-supplied long-lived token." },
    ],
  },
  {
    title: "Publish Destinations",
    description: "Per-channel/page targets (YouTube channel, Facebook page, TikTok account, etc.).",
    endpoints: [
      { method: "GET", path: "/api/publish-destinations", description: "List destinations. Filter with ?type=." },
      { method: "POST", path: "/api/publish-destinations", description: "Create a destination manually." },
      { method: "DELETE", path: "/api/publish-destinations/:id", description: "Delete a destination." },
    ],
  },
  {
    title: "Groups",
    description: "Bundles of destinations that publish together.",
    endpoints: [
      { method: "GET", path: "/api/groups", description: "List all groups with their destinations." },
      { method: "POST", path: "/api/groups", description: "Create a new group.", body: `{ name }` },
      { method: "PATCH", path: "/api/groups/:id", description: "Rename a group.", body: `{ name }` },
      { method: "DELETE", path: "/api/groups/:id", description: "Delete a group." },
      { method: "POST", path: "/api/groups/:id/destinations", description: "Add a destination to the group.", body: `{ destinationId }` },
      { method: "DELETE", path: "/api/groups/:id/destinations/:destinationId", description: "Remove a destination from the group." },
      { method: "POST", path: "/api/groups/:id/upload", description: "Upload a video for the group (multipart)." },
      { method: "POST", path: "/api/groups/:id/publish", description: "Fan out a publish job to every destination in the group.", body: `{ videoPath, title?, caption?, privacy?, scheduledAt? }` },
    ],
  },
  {
    title: "Post Jobs",
    description: "Individual publish jobs. Job runner polls the table every 2 seconds.",
    endpoints: [
      { method: "GET", path: "/api/post-jobs", description: "List jobs (newest first). Also starts the runner on first hit." },
      { method: "POST", path: "/api/post-jobs", description: "Create a single publish job.", body: `{ accountId, videoPath, destinationId?, title?, caption?, privacy?, scheduledAt? }` },
      { method: "GET", path: "/api/post-jobs/:id", description: "Get a job along with its logs." },
      { method: "DELETE", path: "/api/post-jobs/:id", description: "Delete a job." },
      { method: "POST", path: "/api/post-jobs/:id/retry", description: "Re-queue a failed job." },
      { method: "GET", path: "/api/post-jobs/:id/events", description: "Server-sent events stream for live status and log updates.", notes: "text/event-stream — connect with EventSource." },
    ],
  },
  {
    title: "Videos",
    description: "Upload temporary video files for jobs.",
    endpoints: [
      { method: "POST", path: "/api/videos/upload", description: "Upload a video file (multipart). Returns { videoPath }." },
    ],
  },
];

export default function ApiDocsPage() {
  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">API Reference</h1>
        <p className="text-gray-400 text-sm mt-1">
          All endpoints are served by this app at <code className="font-mono text-indigo-300">http://localhost:20129</code>.
          Request and response bodies are JSON unless noted.
        </p>
      </div>

      <div className="space-y-8">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-widest">{section.title}</h2>
              {section.description && (
                <p className="text-xs text-gray-500 mt-1">{section.description}</p>
              )}
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] overflow-hidden divide-y divide-[var(--border)]">
              {section.endpoints.map((ep) => (
                <div key={ep.method + ep.path} className="px-5 py-3.5">
                  <div className="flex items-baseline gap-3">
                    <span
                      className={`shrink-0 inline-flex items-center justify-center text-[10px] font-bold font-mono w-14 px-1.5 py-0.5 rounded border ${METHOD_STYLES[ep.method]}`}
                    >
                      {ep.method}
                    </span>
                    <code className="font-mono text-sm text-white">{ep.path}</code>
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5 ml-[68px]">{ep.description}</p>
                  {ep.body && (
                    <div className="ml-[68px] mt-2">
                      <span className="text-[10px] uppercase tracking-wider text-gray-600 mr-2">Body</span>
                      <code className="font-mono text-xs text-gray-300 bg-black/30 px-2 py-0.5 rounded">{ep.body}</code>
                    </div>
                  )}
                  {ep.notes && (
                    <p className="text-[11px] text-gray-500 mt-1.5 ml-[68px] italic">{ep.notes}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
