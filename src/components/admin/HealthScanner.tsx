"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, Notice, PageHeader, Spinner, adminFetch } from "@/components/admin/ui";
import { Activity, RefreshCw } from "lucide-react";

interface Issue {
  id: string;
  type: "PASS" | "WARNING" | "ERROR";
  title: string;
  detail: string;
}

export function HealthScanner() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const run = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await adminFetch<{ issues: Issue[] }>("/api/admin/health");
      setIssues(data.issues);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void run();
    });
  }, [run]);

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6">
      <PageHeader
        eyebrow="STOREFRONT AUDIT"
        title="Health Scanner"
        icon={<Activity className="w-7 h-7 text-emerald-400" />}
        actions={
          <Button variant="ghost" onClick={run}>
            <span className="flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5" /> Re-run scan
            </span>
          </Button>
        }
      />

      {error && <Notice tone="error">{error}</Notice>}

      <Card>
        {loading ? (
          <Spinner label="Scanning storefront..." />
        ) : (
          <ul className="space-y-3">
            {issues.map((issue) => (
              <li key={issue.id} className="flex items-start gap-3 border border-white/10 p-3">
                <Badge tone={issue.type === "PASS" ? "success" : issue.type === "WARNING" ? "warning" : "danger"}>{issue.type}</Badge>
                <div>
                  <p className="text-xs text-white font-bold uppercase">{issue.title}</p>
                  <p className="text-[11px] text-zinc-400">{issue.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
