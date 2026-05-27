"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Account = {
  id: string;
  displayName: string | null;
  username: string | null;
  providerName: string | null;
  providerType: string | null;
};

function PostForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [form, setForm] = useState({
    accountId: "",
    videoPath: params.get("videoPath") ?? "",
    title: "",
    caption: "",
    privacy: "private",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/accounts").then((r) => r.json()).then(setAccounts);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/post-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: form.accountId,
          videoPath: form.videoPath,
          title: form.title || undefined,
          caption: form.caption || undefined,
          privacy: form.privacy,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed");
      } else {
        router.push(`/jobs/${data.id}`);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-6">Create Post Job</h1>

      {accounts.length === 0 && (
        <div className="mb-6 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm">
          No connected accounts.{" "}
          <a href="/providers" className="underline">
            Connect an account first.
          </a>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-6 space-y-5"
      >
        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div>
          <label className="block text-xs text-gray-400 mb-1">Account</label>
          <select
            required
            value={form.accountId}
            onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))}
            className="w-full bg-black/30 border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="">Select account...</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.displayName ?? acc.username ?? acc.id} ({acc.providerType})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Video Path</label>
          <input
            required
            value={form.videoPath}
            onChange={(e) => setForm((f) => ({ ...f, videoPath: e.target.value }))}
            className="w-full bg-black/30 border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
            placeholder="C:\Videos\my-video.mp4"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Title</label>
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="w-full bg-black/30 border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            placeholder="optional"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Caption</label>
          <textarea
            value={form.caption}
            onChange={(e) => setForm((f) => ({ ...f, caption: e.target.value }))}
            rows={3}
            className="w-full bg-black/30 border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
            placeholder="optional"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Privacy</label>
          <select
            value={form.privacy}
            onChange={(e) => setForm((f) => ({ ...f, privacy: e.target.value }))}
            className="w-full bg-black/30 border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="private">private</option>
            <option value="public">public</option>
            <option value="unlisted">unlisted</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={submitting || accounts.length === 0}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
        >
          {submitting ? "Submitting..." : "Submit Job"}
        </button>
      </form>
    </div>
  );
}

export default function PostPage() {
  return (
    <Suspense>
      <PostForm />
    </Suspense>
  );
}
