"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RetryButton({ jobId }: { jobId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleRetry() {
    setLoading(true);
    await fetch(`/api/post-jobs/${jobId}/retry`, { method: "POST" });
    router.refresh();
    setLoading(false);
  }

  return (
    <button
      onClick={handleRetry}
      disabled={loading}
      className="w-full flex items-center justify-center gap-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
    >
      {loading ? (
        <>
          <span className="w-3.5 h-3.5 rounded-full border-2 border-indigo-400/30 border-t-indigo-400 animate-spin" />
          Retrying…
        </>
      ) : (
        "↺  Retry Job"
      )}
    </button>
  );
}
