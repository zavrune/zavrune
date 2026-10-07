import React from "react";
import { redirect } from "next/navigation";
import { Shield } from "lucide-react";
import { getAdminSessionOrNull } from "@/lib/auth";
import { LoginForm } from "@/components/admin/LoginForm";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [session, params] = await Promise.all([getAdminSessionOrNull(), searchParams]);
  const next = typeof params?.next === "string" && params.next.startsWith("/mohamedbdr") ? params.next : "/mohamedbdr";

  if (session) redirect(next);

  return (
    <div className="min-h-screen bg-[#08080A] text-zinc-100 flex items-center justify-center p-4 font-mono">
      <div className="w-full max-w-md bg-[#121216] border border-white/15 p-8 space-y-6 shadow-2xl">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-white text-black rounded-full mb-2">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-widest text-white">ZAVRUNE ADMIN</h1>
          <p className="text-xs text-zinc-400">Private store management area.</p>
        </div>
        <LoginForm nextPath={next} />
      </div>
    </div>
  );
}
