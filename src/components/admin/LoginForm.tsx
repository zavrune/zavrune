"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Sign-in failed.");
      }

      router.replace(nextPath);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Sign-in failed.");
      setPassword("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
      {error && (
        <div className="p-3 bg-red-950 border border-red-500/50 text-red-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div>
        <label className="block text-xs text-zinc-300 mb-1 uppercase">Admin Email</label>
        <input
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-black border border-white/20 px-3 py-2 text-sm text-white focus:outline-none focus:border-white"
        />
      </div>

      <div>
        <label className="block text-xs text-zinc-300 mb-1 uppercase">Password</label>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-black border border-white/20 px-3 py-2 text-sm text-white focus:outline-none focus:border-white"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-white text-black font-extrabold text-xs uppercase tracking-widest hover:bg-zinc-200 transition-colors disabled:opacity-50"
      >
        {loading ? "Authenticating..." : "Sign In"}
      </button>

      <p className="text-[10px] text-zinc-500 text-center leading-relaxed">
        Accounts are provisioned from the ZAVRUNE_ADMIN_EMAIL / ZAVRUNE_ADMIN_PASSWORD environment variables.
        Failed attempts are rate limited.
      </p>
    </form>
  );
}
