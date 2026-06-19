"use client";

import { useEffect, useState } from "react";

type LogEntry = {
  id: number;
  accountId: string;
  timestamp: string;
  update: any;
  result: string;
};

type WebhookStatus = {
  accountId: string;
  botName?: string;
  webhookUrl?: string | null;
  pendingUpdateCount?: number;
  lastErrorDate?: string | null;
  lastErrorMessage?: string | null;
  allowedUpdates?: string[] | null;
  error?: string;
};

export default function WebhookLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [statuses, setStatuses] = useState<WebhookStatus[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState(false);

  async function fetchLogs() {
    try {
      const res = await fetch("/api/webhooks/telegram/logs");
      if (res.ok) setLogs(await res.json());
    } catch {}
  }

  async function fetchStatus() {
    setLoadingStatus(true);
    try {
      const res = await fetch("/api/webhooks/telegram/status");
      if (res.ok) setStatuses(await res.json());
    } catch {}
    setLoadingStatus(false);
  }

  useEffect(() => {
    fetchLogs();
    fetchStatus();
    if (!autoRefresh) return;
    const id = setInterval(fetchLogs, 3000);
    return () => clearInterval(id);
  }, [autoRefresh]);

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function clearLogs() {
    await fetch("/api/webhooks/telegram/logs", { method: "DELETE" });
    setLogs([]);
  }

  function getMessageSummary(update: any): string {
    const msg = update?.message;
    if (!msg) return "No message";
    const text = msg.caption || msg.text || "";
    const from = msg.from?.username ? `@${msg.from.username}` : msg.from?.first_name || "unknown";
    const chat = msg.chat?.title || msg.chat?.id || "unknown";
    const hasVideo = !!(msg.video || msg.document);
    const parts = [`from ${from} in ${chat}`];
    if (hasVideo) parts.push("[video]");
    if (text) parts.push(text.slice(0, 80));
    return parts.join(" — ");
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Webhook Logs</h1>
          <p className="text-sm text-gray-500 mt-1">
            {logs.length} message{logs.length !== 1 ? "s" : ""} received
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-600"
            />
            Auto-refresh
          </label>
          <button
            onClick={fetchLogs}
            className="px-3 py-1.5 text-sm bg-white/5 hover:bg-white/10 text-gray-300 rounded-md transition-colors"
          >
            Refresh
          </button>
          <button
            onClick={clearLogs}
            className="px-3 py-1.5 text-sm bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-md transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Webhook Status */}
      <div className="mb-6 border border-[var(--border)] rounded-lg bg-[var(--muted)] p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">Webhook Status</h2>
          <button
            onClick={fetchStatus}
            disabled={loadingStatus}
            className="px-2 py-1 text-xs bg-white/5 hover:bg-white/10 text-gray-400 rounded transition-colors disabled:opacity-50"
          >
            {loadingStatus ? "Checking..." : "Re-check"}
          </button>
        </div>
        {statuses.length === 0 ? (
          <p className="text-sm text-gray-500">No Telegram bot accounts found</p>
        ) : (
          <div className="space-y-3">
            {statuses.map((s) => (
              <div key={s.accountId} className="bg-black/20 rounded p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      s.error ? "bg-red-400" : s.webhookUrl ? "bg-green-400" : "bg-yellow-400"
                    }`}
                  />
                  <span className="text-sm font-medium text-white">{s.botName || s.accountId}</span>
                  <span className="text-xs text-gray-600 font-mono">{s.accountId}</span>
                </div>
                {s.error ? (
                  <p className="text-xs text-red-400">{s.error}</p>
                ) : (
                  <div className="space-y-1 text-xs">
                    <div className="flex gap-2">
                      <span className="text-gray-500 w-24 shrink-0">URL:</span>
                      <span className={s.webhookUrl ? "text-green-400" : "text-yellow-400"}>
                        {s.webhookUrl || "Not set"}
                      </span>
                    </div>
                    {s.pendingUpdateCount !== undefined && s.pendingUpdateCount > 0 && (
                      <div className="flex gap-2">
                        <span className="text-gray-500 w-24 shrink-0">Pending:</span>
                        <span className="text-yellow-400">{s.pendingUpdateCount} updates</span>
                      </div>
                    )}
                    {s.lastErrorMessage && (
                      <div className="flex gap-2">
                        <span className="text-gray-500 w-24 shrink-0">Last error:</span>
                        <span className="text-red-400">
                          {s.lastErrorMessage}
                          {s.lastErrorDate && (
                            <span className="text-gray-600 ml-2">
                              ({new Date(s.lastErrorDate).toLocaleString()})
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                    {s.allowedUpdates && (
                      <div className="flex gap-2">
                        <span className="text-gray-500 w-24 shrink-0">Updates:</span>
                        <span className="text-gray-400">{s.allowedUpdates.join(", ") || "all"}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Logs */}
      {logs.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p className="text-lg">No webhook messages yet</p>
          <p className="text-sm mt-2">Send a message to a Telegram group with the bot to see it here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className="border border-[var(--border)] rounded-lg bg-[var(--muted)] overflow-hidden"
            >
              <button
                onClick={() => toggle(log.id)}
                className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/5 transition-colors"
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    log.result === "ok" ? "bg-green-400" : "bg-red-400"
                  }`}
                />
                <span className="text-xs text-gray-500 shrink-0 font-mono">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className="text-sm text-gray-300 truncate flex-1">
                  {getMessageSummary(log.update)}
                </span>
                {log.result !== "ok" && (
                  <span className="text-xs text-red-400 shrink-0">{log.result.slice(0, 50)}</span>
                )}
                <span className="text-gray-600 text-xs shrink-0">
                  {expanded.has(log.id) ? "▼" : "▶"}
                </span>
              </button>
              {expanded.has(log.id) && (
                <div className="px-4 pb-4 border-t border-[var(--border)]">
                  <div className="mt-3 space-y-2">
                    <div className="flex gap-2 text-xs">
                      <span className="text-gray-500">Account:</span>
                      <span className="text-gray-300 font-mono">{log.accountId}</span>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <span className="text-gray-500">Result:</span>
                      <span className={log.result === "ok" ? "text-green-400" : "text-red-400"}>
                        {log.result}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Raw payload:</p>
                      <pre className="text-xs text-gray-400 bg-black/30 rounded p-3 overflow-x-auto max-h-80">
                        {JSON.stringify(log.update, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
