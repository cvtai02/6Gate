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
      className="w-full bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 border border-yellow-500/30 px-5 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
    >
      {loading ? "Retrying..." : "Retry Job"}
    </button>
  );
}
