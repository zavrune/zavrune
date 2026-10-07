"use client";

import React, { useEffect, useState } from "react";
import { Button, Card, Field, Input, Notice, PageHeader, Spinner, adminFetch } from "@/components/admin/ui";
import { Palette } from "lucide-react";

const TOKEN_FIELDS: { key: string; label: string; type: "color" | "text" }[] = [
  { key: "bgPrimary", label: "Page background", type: "color" },
  { key: "bgSurface", label: "Surface", type: "color" },
  { key: "textPrimary", label: "Primary text", type: "color" },
  { key: "textMuted", label: "Muted text", type: "color" },
  { key: "accent", label: "Accent", type: "color" },
  { key: "btnBg", label: "Button background", type: "color" },
  { key: "btnText", label: "Button text", type: "color" },
  { key: "borderColor", label: "Border colour", type: "text" },
  { key: "borderRadius", label: "Border radius", type: "text" },
  { key: "typographyFont", label: "Font", type: "text" },
  { key: "shadows", label: "Shadows", type: "text" },
];

export function DesignSystemForm() {
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/settings/design");
        const data = await res.json();
        setTokens(data?.theme ?? {});
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await adminFetch("/api/settings/design", { method: "POST", body: JSON.stringify({ theme: tokens }) });
      setNotice("Design tokens saved.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner label="Loading design system..." />;

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6">
      <PageHeader
        eyebrow="BRAND SURFACE"
        title="Design System"
        icon={<Palette className="w-7 h-7 text-purple-400" />}
        actions={
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save tokens"}
          </Button>
        }
      />

      {error && <Notice tone="error" onDismiss={() => setError("")}>{error}</Notice>}
      {notice && <Notice tone="success" onDismiss={() => setNotice("")}>{notice}</Notice>}

      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TOKEN_FIELDS.map((field) => (
            <Field key={field.key} label={field.label}>
              {field.type === "color" ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={tokens[field.key] ?? "#000000"}
                    onChange={(e) => setTokens({ ...tokens, [field.key]: e.target.value })}
                    className="w-16 h-9 p-1"
                  />
                  <Input value={tokens[field.key] ?? ""} onChange={(e) => setTokens({ ...tokens, [field.key]: e.target.value })} />
                </div>
              ) : (
                <Input value={tokens[field.key] ?? ""} onChange={(e) => setTokens({ ...tokens, [field.key]: e.target.value })} />
              )}
            </Field>
          ))}
        </div>
        <p className="text-[10px] text-zinc-500">
          These tokens are served publicly to the storefront theme provider; only authenticated admins can change them.
        </p>
      </Card>
    </div>
  );
}
