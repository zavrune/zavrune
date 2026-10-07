"use client";

import React from "react";

export function PageHeader({
  eyebrow,
  title,
  icon,
  actions,
}: {
  eyebrow?: string;
  title: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
      <div>
        {eyebrow && <span className="text-xs text-zinc-400 uppercase tracking-widest block mb-1">{eyebrow}</span>}
        <h1 className="text-2xl sm:text-3xl font-black uppercase text-white tracking-tight flex items-center gap-3">
          {icon}
          <span>{title}</span>
        </h1>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-[#121216] border border-white/10 p-4 sm:p-6 space-y-4 ${className}`}>{children}</div>;
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "subtle" }) {
  const styles: Record<string, string> = {
    primary: "bg-white text-black hover:bg-zinc-200 font-extrabold",
    ghost: "bg-black text-zinc-200 border border-white/20 hover:border-white/50",
    subtle: "bg-white/10 text-white hover:bg-white/20",
    danger: "bg-red-950/70 text-red-200 border border-red-500/40 hover:bg-red-900",
  };
  return (
    <button
      {...props}
      className={`px-3 py-2 text-xs uppercase tracking-wide transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block space-y-1 ${className}`}>
      <span className="block text-[11px] uppercase text-zinc-300 font-bold">{label}</span>
      {children}
      {hint && <span className="block text-[10px] text-zinc-500">{hint}</span>}
    </label>
  );
}

const inputClass =
  "w-full bg-black border border-white/20 px-3 py-2 text-sm text-white focus:outline-none focus:border-white disabled:opacity-50";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${inputClass} ${props.className ?? ""}`}>
      {props.children}
    </select>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 text-[11px] uppercase font-bold text-zinc-300"
    >
      <span className={`w-9 h-5 border ${checked ? "bg-emerald-500/80 border-emerald-400" : "bg-black border-white/20"} relative transition-colors`}>
        <span className={`absolute top-0.5 w-3.5 h-3.5 bg-white transition-all ${checked ? "left-4.5" : "left-0.5"}`} />
      </span>
      {label}
    </button>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-white/10 text-zinc-200 border-white/15",
    success: "bg-emerald-950 text-emerald-300 border-emerald-500/30",
    warning: "bg-amber-950 text-amber-300 border-amber-500/30",
    danger: "bg-red-950 text-red-300 border-red-500/30",
    info: "bg-sky-950 text-sky-300 border-sky-500/30",
  };
  return (
    <span className={`inline-block px-1.5 py-0.5 text-[10px] uppercase font-bold border ${tones[tone]}`}>{children}</span>
  );
}

export function Notice({
  tone = "info",
  children,
  onDismiss,
}: {
  tone?: "info" | "error" | "success";
  children: React.ReactNode;
  onDismiss?: () => void;
}) {
  const tones: Record<string, string> = {
    info: "bg-sky-950/60 border-sky-500/40 text-sky-100",
    error: "bg-red-950/70 border-red-500/50 text-red-200",
    success: "bg-emerald-950/60 border-emerald-500/40 text-emerald-200",
  };
  return (
    <div className={`p-3 border text-xs flex items-start justify-between gap-3 ${tones[tone]}`}>
      <span>{children}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="text-current opacity-60 hover:opacity-100" aria-label="Dismiss">
          ✕
        </button>
      )}
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-sm overflow-y-auto">
      <div className={`w-full ${wide ? "max-w-4xl" : "max-w-2xl"} bg-[#121216] border border-white/20 text-white my-6`}>
        <div className="flex items-center justify-between p-4 border-b border-white/10 sticky top-0 bg-[#121216] z-10">
          <h3 className="text-sm font-bold uppercase">{title}</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white px-1" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="p-4 sm:p-6 space-y-4">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="py-10 text-center text-zinc-500 text-xs">{children}</div>;
}

export function Spinner({ label = "Loading..." }: { label?: string }) {
  return <div className="py-10 text-center text-zinc-500 text-xs animate-pulse">{label}</div>;
}

export function formatDZD(value: number | null | undefined) {
  const amount = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return `${amount.toLocaleString("en-US")} DZD`;
}

export async function adminFetch<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {}),
    },
  });

  const payload = await res.json().catch(() => ({}) as any);
  if (!res.ok || payload?.success === false) {
    throw new Error(payload?.error || `Request failed (${res.status})`);
  }
  return payload as T;
}
