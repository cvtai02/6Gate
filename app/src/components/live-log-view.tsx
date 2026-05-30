"use client";

import { useEffect, useRef, useState } from "react";

type LogEntry = {
  id?: string;
  level: string;
  message: string;
  createdAt?: string;
};

const LEVEL_COLOR: Record<string, string> = {
  info:  "text-blue-400",
  warn:  "text-yellow-400",
  error: "text-red-400",
};

function fmtTime(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

export function LiveLogView({
  jobId,
  initialLogs = [],
  isLive = true,
}: {
  jobId: string;
  initialLogs?: LogEntry[];
  isLive?: boolean;
}) {
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLive) return;
    const es = new EventSource(`/api/post-jobs/${jobId}/events`);

    es.onopen = () => setConnected(true);

    es.addEventListener("log", (e) => {
      const data = JSON.parse(e.data) as LogEntry;
      setLogs((prev) => {
        const isDup = prev.some(
          (l) => l.message === data.message && l.createdAt === data.createdAt
        );
        return isDup ? prev : [...prev, data];
      });
    });

    es.addEventListener("status", (e) => {
      const { status } = JSON.parse(e.data) as { status: string };
      setLiveStatus(status);
      if (["Published", "Failed", "Cancelled"].includes(status)) {
        es.close();
        setConnected(false);
      }
    });

    es.onerror = () => {
      es.close();
      setConnected(false);
    };

    return () => {
      es.close();
      setConnected(false);
    };
  }, [jobId, isLive]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden">

      {/* Terminal chrome */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--muted)] border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500/50" />
            <span className="w-3 h-3 rounded-full bg-yellow-500/50" />
            <span className="w-3 h-3 rounded-full bg-green-500/50" />
          </div>
          <span className="text-xs text-gray-500 font-mono">stdout / logs</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {isLive && (
            <span className={`flex items-center gap-1.5 ${connected ? "text-green-400" : "text-gray-600"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-green-400 animate-pulse" : "bg-gray-600"}`} />
              {connected ? "live" : "idle"}
            </span>
          )}
          {liveStatus && (
            <span className="text-gray-500 font-mono">
              → <span className="text-white">{liveStatus}</span>
            </span>
          )}
          <span className="text-gray-600 font-mono tabular-nums">{logs.length} lines</span>
        </div>
      </div>

      {/* Log body */}
      <div className="bg-[#0d0d10] font-mono text-xs p-4 min-h-[100px] max-h-96 overflow-y-auto">
        {logs.length === 0 ? (
          <p className="text-gray-600 italic">
            {isLive ? "Waiting for output..." : "No logs recorded."}
          </p>
        ) : (
          <div className="space-y-1.5">
            {logs.map((log, i) => (
              <div key={i} className="flex gap-3 leading-relaxed">
                <span className="text-gray-600 shrink-0 select-none tabular-nums w-20">
                  {fmtTime(log.createdAt)}
                </span>
                <span className={`shrink-0 w-14 ${LEVEL_COLOR[log.level] ?? "text-gray-400"}`}>
                  [{log.level}]
                </span>
                <span className="text-gray-200 break-all">{log.message}</span>
              </div>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

    </div>
  );
}
