import { NextResponse } from "next/server";
import { AdminApiError, requireAdminApi, type AdminSessionContext } from "@/lib/auth";
import { logDatabaseError } from "@/db/initialize";

export function jsonOk<T extends Record<string, unknown>>(payload: T, status = 200) {
  return NextResponse.json({ success: true, ...payload }, { status });
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export function jsonServerError(context: string, error: unknown) {
  logDatabaseError(context, error);
  return NextResponse.json({ success: false, error: "Database request failed" }, { status: 500 });
}

/**
 * Wraps an admin API handler. Authorization (and cross-site protection for
 * state-changing methods) happens before the handler runs, so no admin data can
 * be read or written without a valid session.
 */
export async function withAdmin(
  req: Request,
  handler: (session: AdminSessionContext, url: URL) => Promise<Response>,
  options: { context?: string } = {}
): Promise<Response> {
  const context = options.context ?? "admin request";
  try {
    const session = await requireAdminApi(req, { csrf: true });
    const url = new URL(req.url);
    return await handler(session, url);
  } catch (error) {
    if (error instanceof AdminApiError) {
      return jsonError(error.message, error.status);
    }
    return jsonServerError(context, error);
  }
}

export interface Pagination {
  page: number;
  pageSize: number;
  offset: number;
  search: string;
}

export function parsePagination(
  url: URL,
  options: { defaultPageSize?: number; maxPageSize?: number } = {}
): Pagination {
  const defaultPageSize = options.defaultPageSize ?? 50;
  const maxPageSize = options.maxPageSize ?? 200;

  const rawPage = Number(url.searchParams.get("page") ?? "1");
  const rawSize = Number(url.searchParams.get("pageSize") ?? String(defaultPageSize));

  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const pageSize = Number.isFinite(rawSize) && rawSize > 0 ? Math.min(Math.floor(rawSize), maxPageSize) : defaultPageSize;

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
    search: (url.searchParams.get("q") ?? "").trim().slice(0, 120),
  };
}

export async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new AdminApiError("A JSON object body is required.", 400);
    }
    return body as Record<string, unknown>;
  } catch (error) {
    if (error instanceof AdminApiError) throw error;
    throw new AdminApiError("Invalid JSON body.", 400);
  }
}

export function requireString(value: unknown, field: string, maxLength = 500): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new AdminApiError(`${field} is required.`, 400);
  }
  return value.trim().slice(0, maxLength);
}

export function optionalString(value: unknown, maxLength = 2000): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

export function toInteger(value: unknown, fallback: number | null = null): number | null {
  if (value === null || value === undefined || value === "") return fallback;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.round(numeric);
}

export function toNonNegativeInteger(value: unknown, fallback = 0): number {
  const numeric = toInteger(value, fallback);
  if (numeric === null) return fallback;
  return Math.max(0, numeric);
}

export function toBoolean(value: unknown, fallback = false): boolean {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true" || value === "1";
  return Boolean(value);
}

export function toUuidOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed) ? trimmed : null;
}

export function slugify(value: string, maxLength = 80): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength);
}

/** Media URLs an admin may attach: site-relative or http(s) only. */
export function sanitizeMediaUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/")) return trimmed.slice(0, 1200);
  try {
    const url = new URL(trimmed);
    if (url.protocol === "http:" || url.protocol === "https:") return trimmed.slice(0, 1200);
  } catch {
    return null;
  }
  return null;
}
