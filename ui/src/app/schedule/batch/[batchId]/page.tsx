"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ProcessFlow, type Batch } from "./process-flow";

export default function BatchDetailPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const [batch, setBatch] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/history/${batchId}`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "Batch not found" : `HTTP ${r.status}`);
        return r.json();
      })
      .then(setBatch)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [batchId]);

  if (loading) {
    return (
      <div className="p-8 max-w-6xl space-y-4 animate-pulse">
        <div className="h-8 w-48 rounded-lg bg-[var(--muted)]" />
        <div className="h-40 rounded-xl bg-[var(--muted)]" />
      </div>
    );
  }

  if (error || !batch) {
    return (
      <div className="p-8 max-w-6xl">
        <Link href="/schedule" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 mb-5 transition-colors">&larr; Schedule</Link>
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">{error || "Batch not found"}</p>
      </div>
    );
  }

  const label = [batch.groupName, batch.title].filter(Boolean).join(" - ") || "Untitled";

  return (
    <div className="p-8 max-w-6xl">
      <Link href="/schedule" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 mb-5 transition-colors">&larr; Schedule</Link>

      <div className="mb-8">
        <h1 className="text-xl font-semibold text-white">{label}</h1>
        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
          {batch.groupName && batch.groupId && (
            <>
              <Link href={`/groups/${batch.groupId}`} className="text-indigo-400/80 hover:text-indigo-300">{batch.groupName}</Link>
              <span>&middot;</span>
            </>
          )}
          <span>{batch.jobs.length} destination{batch.jobs.length !== 1 ? "s" : ""}</span>
          <span>&middot;</span>
          <span className="font-mono">{new Date(batch.createdAt).toLocaleString()}</span>
        </div>
      </div>

      <ProcessFlow batch={batch} />
    </div>
  );
}
