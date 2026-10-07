"use client";

import React, { useState } from "react";
import { Shield, Lock, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@zavrune.com");
  const [password, setPassword] = useState("admin123");
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

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Login failed");
      }

      router.push("/admin");
    } catch (err: any) {
      setError(err.message || "Failed to log in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#08080A] text-zinc-100 flex items-center justify-center p-4 font-mono">
      <div className="w-full max-w-md bg-[#121216] border border-white/15 p-8 space-y-6 shadow-2xl">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-white text-black rounded-full mb-2">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-widest text-white">
            ZAVRUNE ADMIN
          </h1>
          <p className="text-xs text-zinc-400">
            Sign in to access storefront builder, orders, inventory & health scanner.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-950 border border-red-500/50 text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-zinc-300 mb-1 uppercase">
              Admin Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black border border-white/20 px-3 py-2 text-sm text-white focus:outline-none focus:border-white"
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-300 mb-1 uppercase">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black border border-white/20 px-3 py-2 text-sm text-white focus:outline-none focus:border-white"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-white text-black font-extrabold text-xs uppercase tracking-widest hover:bg-zinc-200 transition-colors"
          >
            {loading ? "Authenticating..." : "Sign In to Admin Portal"}
          </button>
        </form>

        <div className="text-[11px] text-zinc-500 text-center border-t border-white/10 pt-4">
          Default login: <strong className="text-zinc-300">admin@zavrune.com</strong>
        </div>
      </div>
    </div>
  );
}
