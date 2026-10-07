"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, Field, Input, Notice, PageHeader, Spinner, adminFetch } from "@/components/admin/ui";
import { KeyRound, LogOut, MonitorSmartphone, ShieldCheck } from "lucide-react";

interface SessionRow {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  userAgent: string | null;
  ipHash: string | null;
  isCurrent: boolean;
}

export function SecurityPanel({ adminEmail, initialActiveSessions }: { adminEmail: string; initialActiveSessions: number }) {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch<{ sessions: SessionRow[] }>("/api/admin/security/sessions");
      setSessions(data.sessions);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");

    if (newPassword !== confirmPassword) {
      setError("The new password and confirmation do not match.");
      return;
    }

    setBusy(true);
    try {
      const data = await adminFetch<{ message: string }>("/api/admin/security/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setNotice(data.message ?? "Password updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (mode: "others" | "all") => {
    const message =
      mode === "all"
        ? "Sign out of every device, including this one?"
        : "Sign out of every other device?";
    if (!confirm(message)) return;

    setBusy(true);
    try {
      const data = await adminFetch<{ message: string; signedOutSelf: boolean }>(
        `/api/admin/security/sessions?mode=${mode}`,
        { method: "DELETE" }
      );
      setNotice(data.message);
      if (data.signedOutSelf) {
        window.location.href = "/mohamedbdr/login";
        return;
      }
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6">
      <PageHeader
        eyebrow="ACCOUNT PROTECTION"
        title="Security"
        icon={<ShieldCheck className="w-7 h-7 text-emerald-400" />}
        actions={<span className="text-xs text-zinc-400">{adminEmail}</span>}
      />

      {error && <Notice tone="error" onDismiss={() => setError("")}>{error}</Notice>}
      {notice && <Notice tone="success" onDismiss={() => setNotice("")}>{notice}</Notice>}

      <Card>
        <h2 className="text-sm font-bold uppercase text-white border-b border-white/10 pb-3 flex items-center gap-2">
          <KeyRound className="w-4 h-4" /> Change password
        </h2>
        <form onSubmit={changePassword} className="space-y-3">
          <Field label="Current password">
            <Input type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="New password" hint="At least 10 characters with letters and numbers.">
              <Input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </Field>
            <Field label="Confirm new password">
              <Input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </Field>
          </div>
          <p className="text-[10px] text-zinc-500">
            Passwords are stored as bcrypt hashes. Changing the password invalidates every existing session; this device receives a
            fresh one.
          </p>
          <div className="flex justify-end">
            <Button type="submit" disabled={busy}>
              {busy ? "Updating..." : "Update password"}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
          <h2 className="text-sm font-bold uppercase text-white flex items-center gap-2">
            <MonitorSmartphone className="w-4 h-4" /> Active sessions ({sessions.length || initialActiveSessions})
          </h2>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => revoke("others")} disabled={busy}>
              Sign out other devices
            </Button>
            <Button variant="danger" onClick={() => revoke("all")} disabled={busy}>
              <span className="flex items-center gap-2">
                <LogOut className="w-3.5 h-3.5" /> Sign out all
              </span>
            </Button>
          </div>
        </div>

        {loading ? (
          <Spinner label="Loading sessions..." />
        ) : sessions.length === 0 ? (
          <p className="text-xs text-zinc-500">No active sessions.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-black text-zinc-400 uppercase border-b border-white/10">
                <tr>
                  <th className="p-2">Device</th>
                  <th className="p-2">Created</th>
                  <th className="p-2">Last seen</th>
                  <th className="p-2">Expires</th>
                  <th className="p-2">Origin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sessions.map((session) => (
                  <tr key={session.id}>
                    <td className="p-2 text-zinc-200 max-w-[280px] truncate">
                      {session.isCurrent && <Badge tone="success">This device</Badge>}{" "}
                      <span className="text-[10px] text-zinc-500">{session.userAgent ?? "Unknown device"}</span>
                    </td>
                    <td className="p-2 text-zinc-400">{new Date(session.createdAt).toLocaleString()}</td>
                    <td className="p-2 text-zinc-400">{new Date(session.lastSeenAt).toLocaleString()}</td>
                    <td className="p-2 text-zinc-400">{new Date(session.expiresAt).toLocaleDateString()}</td>
                    <td className="p-2 text-zinc-500 text-[10px]">{session.ipHash ? `ip:${session.ipHash.slice(0, 8)}…` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-bold uppercase text-white border-b border-white/10 pb-3">How this is protected</h2>
        <ul className="text-[11px] text-zinc-400 space-y-1.5 list-disc pl-4">
          <li>Sessions use 256-bit cryptographically random tokens, stored only as SHA-256 hashes.</li>
          <li>Cookies are httpOnly, SameSite=Strict and Secure in production; sessions expire after 14 days.</li>
          <li>Sign-in attempts are rate limited per account and per source address.</li>
          <li>State-changing admin requests are rejected unless they come from the same origin.</li>
          <li>Every admin page and admin API revalidates the session server-side before touching data.</li>
        </ul>
      </Card>
    </div>
  );
}
