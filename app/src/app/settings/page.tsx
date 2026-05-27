import { env } from "@/server/config/env";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const settings = [
    { label: "Port", value: env.port.toString() },
    { label: "Data Directory", value: env.dataDir },
    { label: "Database Path", value: env.dbPath },
    { label: "Uploads Directory", value: env.uploadsDir },
    { label: "Logs Directory", value: env.logsDir },
  ];

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-6">Settings</h1>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-6 space-y-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Environment</h2>
        {settings.map(s => (
          <div key={s.label} className="flex flex-col gap-1">
            <dt className="text-xs text-gray-500">{s.label}</dt>
            <dd className="font-mono text-sm text-gray-200 bg-black/30 px-3 py-2 rounded-lg border border-[var(--border)]">
              {s.value}
            </dd>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--muted)] p-6">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">API Reference</h2>
        <div className="space-y-2 font-mono text-xs text-gray-400">
          {[
            "GET  /api/health",
            "GET  /api/providers",
            "POST /api/providers",
            "DELETE /api/providers/:id",
            "GET  /api/accounts",
            "POST /api/accounts/oauth/start",
            "GET  /api/accounts/oauth/callback",
            "DELETE /api/accounts/:id",
            "GET  /api/post-jobs",
            "POST /api/post-jobs",
            "GET  /api/post-jobs/:id",
            "POST /api/post-jobs/:id/retry",
            "GET  /api/post-jobs/:id/events",
          ].map(r => (
            <p key={r}>{r}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
