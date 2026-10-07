"use client";

import React, { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Activity, CheckCircle2, AlertTriangle, XCircle, RefreshCw, Wrench, Layers } from "lucide-react";

export default function StorefrontHealthPage() {
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const runHealthCheck = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/health");
      const data = await res.json();
      if (res.ok && data.issues) {
        setIssues(data.issues);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runHealthCheck();
  }, []);

  const passCount = issues.filter((i) => i.type === "PASS").length;
  const warningCount = issues.filter((i) => i.type === "WARNING").length;
  const errorCount = issues.filter((i) => i.type === "ERROR").length;

  return (
    <AdminLayout>
      <div className="p-6 sm:p-8 max-w-5xl mx-auto space-y-8 font-mono">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-6">
          <div>
            <span className="text-xs text-zinc-400 uppercase tracking-widest block mb-1">
              STOREFRONT AUDIT
            </span>
            <h1 className="text-2xl sm:text-4xl font-black uppercase text-white tracking-tight flex items-center gap-3">
              <Activity className="w-8 h-8 text-emerald-400" />
              <span>STOREFRONT HEALTH SCANNER</span>
            </h1>
          </div>

          <button
            onClick={runHealthCheck}
            disabled={loading}
            className="px-4 py-2 bg-white text-black font-extrabold text-xs uppercase flex items-center gap-2 hover:bg-zinc-200 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span>Re-Scan Storefront</span>
          </button>
        </div>

        {/* Audit Score Breakdown */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[#121216] border border-emerald-500/30 p-4 text-center space-y-1">
            <span className="text-xs text-emerald-400 font-bold uppercase">PASSES</span>
            <div className="text-3xl font-black text-emerald-400">{passCount}</div>
          </div>

          <div className="bg-[#121216] border border-amber-500/30 p-4 text-center space-y-1">
            <span className="text-xs text-amber-400 font-bold uppercase">WARNINGS</span>
            <div className="text-3xl font-black text-amber-400">{warningCount}</div>
          </div>

          <div className="bg-[#121216] border border-red-500/30 p-4 text-center space-y-1">
            <span className="text-xs text-red-400 font-bold uppercase">CRITICAL ERRORS</span>
            <div className="text-3xl font-black text-red-400">{errorCount}</div>
          </div>
        </div>

        {/* Health Results List */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
            DIAGNOSTIC AUDIT LOG
          </h2>

          {loading ? (
            <div className="py-12 text-center text-zinc-500 text-xs animate-pulse">
              Scanning database, image URLs, SEO tags, layout sections...
            </div>
          ) : (
            <div className="space-y-3">
              {issues.map((item) => (
                <div
                  key={item.id}
                  className={`p-4 border flex items-start justify-between gap-4 bg-[#121216] ${
                    item.type === "PASS"
                      ? "border-emerald-500/30 text-emerald-200"
                      : item.type === "WARNING"
                      ? "border-amber-500/30 text-amber-200"
                      : "border-red-500/40 text-red-200"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {item.type === "PASS" && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
                    {item.type === "WARNING" && <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />}
                    {item.type === "ERROR" && <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />}

                    <div>
                      <h3 className="font-bold text-sm text-white uppercase">{item.title}</h3>
                      <p className="text-xs text-zinc-400 mt-0.5">{item.detail}</p>
                    </div>
                  </div>

                  {item.fixAction === "open_builder" && (
                    <a
                      href="/admin/builder"
                      className="px-3 py-1.5 bg-white text-black font-extrabold text-xs uppercase shrink-0 flex items-center gap-1 hover:bg-zinc-200"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Open Builder</span>
                    </a>
                  )}

                  {item.fixAction === "open_products" && (
                    <a
                      href="/admin/products"
                      className="px-3 py-1.5 bg-white text-black font-extrabold text-xs uppercase shrink-0 flex items-center gap-1 hover:bg-zinc-200"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>Fix Products</span>
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
