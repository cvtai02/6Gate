"use client";

import { useState } from "react";
import { setToken } from "@/lib/auth";

export default function LoginPage() {
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.token) {
        setError(data.error ?? "Invalid system secret");
      } else {
        setToken(data.token);
        window.location.href = "/";
      }
    } catch {
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--background)]">
      <div className="w-full max-w-sm px-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--muted)] p-8">
          <div className="mb-8 text-center">
            <h1 className="text-xl font-semibold text-white">6Gate</h1>
            <p className="mt-1 text-sm text-gray-500">Enter your system secret to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {error}
              </p>
            )}

            <div>
              <label className="mb-1.5 block text-xs text-gray-400">System Secret</label>
              <input
                type="password"
                required
                autoFocus
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition-colors focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={!secret || loading}
              className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
