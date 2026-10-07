"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Field, Input, Notice, PageHeader, Spinner, Toggle, adminFetch, formatDZD } from "@/components/admin/ui";
import { Search, Truck } from "lucide-react";

interface RateRow {
  wilayaCode: string;
  wilayaNameEn: string;
  wilayaNameAr: string;
  homePrice: number | null;
  deskPrice: number | null;
  homeEnabled: boolean;
  deskEnabled: boolean;
}

const UNAVAILABLE = "unavailable";

export function DeliverySettings() {
  const [rates, setRates] = useState<RateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const data = await adminFetch<{ rates: RateRow[] }>("/api/admin/delivery");
        setRates(data.rates);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const update = (code: string, patch: Partial<RateRow>) => {
    setRates((prev) => prev.map((rate) => (rate.wilayaCode === code ? { ...rate, ...patch } : rate)));
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await adminFetch("/api/admin/delivery", {
        method: "PATCH",
        body: JSON.stringify({
          rates: rates.map((rate) => ({
            wilayaCode: rate.wilayaCode,
            homePrice: rate.homeEnabled ? rate.homePrice : null,
            deskPrice: rate.deskEnabled ? rate.deskPrice : null,
            homeEnabled: rate.homeEnabled,
            deskEnabled: rate.deskEnabled,
          })),
        }),
      });
      setNotice("Delivery pricing saved. New orders use these prices immediately; existing orders keep their snapshot.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rates;
    return rates.filter(
      (rate) =>
        rate.wilayaCode.includes(query) ||
        rate.wilayaNameEn.toLowerCase().includes(query) ||
        rate.wilayaNameAr.includes(query)
    );
  }, [rates, search]);

  const unavailableCount = rates.filter((rate) => !rate.homeEnabled && !rate.deskEnabled).length;

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
      <PageHeader
        eyebrow="LOGISTICS"
        title="Delivery Settings"
        icon={<Truck className="w-7 h-7 text-blue-400" />}
        actions={
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save all 58 wilayas"}
          </Button>
        }
      />

      {error && <Notice tone="error" onDismiss={() => setError("")}>{error}</Notice>}
      {notice && <Notice tone="success" onDismiss={() => setNotice("")}>{notice}</Notice>}

      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <Field label="Search wilaya">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-zinc-500" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="09, Blida, البليدة" />
            </div>
          </Field>
          <div className="text-[11px] text-zinc-400 space-y-1">
            <p>{rates.length} wilayas configured</p>
            <p>{unavailableCount} wilaya(s) fully unavailable</p>
          </div>
          <p className="text-[10px] text-zinc-500">
            Leave a price empty or toggle the method off to mark it unavailable. The checkout only offers enabled methods and the
            server re-validates the price on every order.
          </p>
        </div>
      </Card>

      <Card>
        {loading ? (
          <Spinner label="Loading delivery rates..." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-black text-zinc-400 uppercase border-b border-white/10">
                <tr>
                  <th className="p-2">#</th>
                  <th className="p-2">Wilaya</th>
                  <th className="p-2">Domicile / Home</th>
                  <th className="p-2">Stop desk / Bureau</th>
                  <th className="p-2">Available</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((rate) => (
                  <tr key={rate.wilayaCode} className="hover:bg-white/5">
                    <td className="p-2 text-zinc-500">{rate.wilayaCode}</td>
                    <td className="p-2">
                      <strong className="text-white block">{rate.wilayaNameEn}</strong>
                      <span className="text-[10px] text-zinc-500" dir="rtl">
                        {rate.wilayaNameAr}
                      </span>
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          disabled={!rate.homeEnabled}
                          value={rate.homePrice === null ? "" : rate.homePrice}
                          onChange={(e) =>
                            update(rate.wilayaCode, {
                              homePrice: e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                          className="w-24"
                        />
                        <span className="text-[10px] text-zinc-500">
                          {rate.homePrice === null ? UNAVAILABLE : formatDZD(rate.homePrice)}
                        </span>
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          disabled={!rate.deskEnabled}
                          value={rate.deskPrice === null ? "" : rate.deskPrice}
                          onChange={(e) =>
                            update(rate.wilayaCode, {
                              deskPrice: e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                          className="w-24"
                        />
                        <span className="text-[10px] text-zinc-500">
                          {rate.deskPrice === null ? UNAVAILABLE : formatDZD(rate.deskPrice)}
                        </span>
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="flex flex-col gap-1">
                        <Toggle
                          checked={rate.homeEnabled}
                          onChange={(value) =>
                            update(rate.wilayaCode, { homeEnabled: value, homePrice: value ? rate.homePrice ?? 0 : null })
                          }
                          label="Home"
                        />
                        <Toggle
                          checked={rate.deskEnabled}
                          onChange={(value) =>
                            update(rate.wilayaCode, { deskEnabled: value, deskPrice: value ? rate.deskPrice ?? 0 : null })
                          }
                          label="Desk"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-white/10 pt-4">
          <Badge tone="info">{filtered.length} shown</Badge>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save all"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
