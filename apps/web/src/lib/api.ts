import "server-only";
import { headers } from "next/headers";
import { auth } from "@/auth";
import type { Lead, Me, SearchResponse, Stats } from "./types";

const API = process.env.LEADVEED_API_URL ?? "http://127.0.0.1:4000";
const KEY = process.env.LEADVEED_INTERNAL_KEY ?? "dev-internal-key";

export class ApiError extends Error {
  constructor(public status: number, public body: any) { super(`API ${status}`); }
}

export async function currentUserId(): Promise<string | null> {
  const s = await auth();
  return (s?.user as { id?: string } | undefined)?.id ?? null;
}

/** Server-side call to the LeadVeed API, on behalf of the signed-in user (if any). */
export async function api<T>(path: string, init: RequestInit & { userId?: string | null; raw?: boolean } = {}): Promise<T> {
  const uid = init.userId === undefined ? await currentUserId() : init.userId;
  const h = await headers();
  const ip = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const res = await fetch(`${API}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      authorization: `Bearer ${KEY}`,
      ...(uid ? { "x-leadveed-user": uid } : {}),
      ...(ip ? { "x-visitor-ip": ip } : {}),
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (init.raw) return res as unknown as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

export async function safe<T>(p: Promise<T>): Promise<T | null> {
  try { return await p; } catch { return null; }
}

export const getStats = () => safe(api<Stats>("/v1/stats", { userId: null }));
export const getMe = () => safe(api<Me>("/v1/me"));
export const search = (qs: string) => api<SearchResponse>(`/v1/search?${qs}`);
export const getLead = (id: string) => api<{ lead: Lead; similar: Lead[] }>(`/v1/leads/${encodeURIComponent(id)}`);
