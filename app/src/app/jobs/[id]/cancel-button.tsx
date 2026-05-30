"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CancelButton({ jobId }: { jobId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleCancel() {
    if (!confirm("Cancel this job?")) return;
    setLoading(true);
    await fetch(`/api/post-jobs/${jobId}/cancel`, { method: "POST" });
    router.refresh();
    setLoading(false);
  }

  return (
    <button
      onClick={handleCancel}
      disabled={loading}
      className="w-full flex items-center justify-center gap-2 bg-red-600/15 hover:bg-red-600/25 text-red-400 border border-red-500/30 px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
    >
      {loading ? (
        <>
          <span className="w-3.5 h-3.5 rounded-full border-2 border-red-400/30 border-t-red-400 animate-spin" />
          Cancelling...
        </>
      ) : (
        "Cancel Job"
      )}
    </button>
  );
}
