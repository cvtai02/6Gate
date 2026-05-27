"use client";

import { useEffect, useRef, useState } from "react";

type LogEntry = {
  level: string;
  message: string;
  createdAt?: string;
};

const levelColor: Record<string, string> = {
  info: "text-blue-400",
  warn: "text-yellow-400",
  error: "text-red-400",
};

export function LiveLogView({ jobId }: { jobId: string }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const es = new EventSource(`/api/post-jobs/${jobId}/events`);

    es.addEventListener("log", (e) => {
      const data = JSON.parse(e.data) as LogEntry;
      setLogs((prev) => [...prev, data]);
    });

    es.addEventListener("status", (e) => {
      const data = JSON.parse(e.data) as { status: string };
      setStatus(data.status);
      if (["completed", "failed", "cancelled"].includes(data.status)) {
        es.close();
      }
    });

    es.onerror = () => es.close();

    return () => es.close();
  }, [jobId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)] overflow-hidden">
      <div className="px-4 py-2 border-b border-[var(--border)] flex items-center justify-between">
        <span className="text-xs text-gray-400 font-mono">Live logs</span>
        {status && (
          <span className="text-xs text-gray-400">
            Final status: <strong className="text-white">{status}</strong>
          </span>
        )}
      </div>
      <div className="font-mono text-xs p-4 max-h-96 overflow-y-auto space-y-1">
        {logs.length === 0 && (
          <p className="text-gray-500 italic">Waiting for logs...</p>
        )}
        {logs.map((log, i) => (
          <div key={i} className="flex gap-2">
            <span className={`${levelColor[log.level] ?? "text-gray-400"} w-12 shrink-0`}>
              [{log.level}]
            </span>
            <span className="text-gray-200">{log.message}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
