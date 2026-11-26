// Mirrors the API's response shapes (apps/api/src/lib/leads.ts).
export interface Lead {
  id: string;
  name: string;
  category: string | null;
  categoryLabel: string | null;
  categoryGroup: string | null;
  brand: string | null;
  address: { street: string | null; city: string | null; region: string | null; postcode: string | null; country: string | null };
  location: { lat: number; lon: number };
  phones: string[];
  websites: string[];
  emails: string[];
  socials: string[];
  domain: string | null;
  openingHours: string | null;
  operatingStatus: string | null;
  signals: { hasPhone: boolean; hasWebsite: boolean; hasEmail: boolean; hasSocials: boolean };
  sources: string[];
  sourceCount: number;
  quality: { score: number; grade: "A" | "B" | "C" | "D"; breakdown: Record<string, number> };
  pagespeed: { mobile: number | null; desktop: number | null; metrics: Record<string, unknown> | null; checkedAt: string | null };
  firstSeen: string;
  lastSeen: string;
  unlocked: boolean;
}

export interface Facet { value: string; count: number }

export interface SearchResponse {
  found: number;
  page: number;
  perPage: number;
  tookMs: number;
  facets: Record<string, Facet[]>;
  hits: Lead[];
}

export interface Stats {
  leads: number;
  countries: number;
  byCountry: { country: string; n: number }[];
  lastImport: { release: string; finished_at: string } | null;
  shares: { website: number; phone: number; email: number };
  avgQuality: number;
}

export interface Me {
  user: { id: string; name: string | null; email: string; image: string | null; plan: string; credits: number;
    subscription_status: string | null; created_at: string };
  plan: { id: string; name: string; credits: number; maxExportRows: number };
  ledger: { delta: number; reason: string; ref: string | null; created_at: string }[];
  exports: { id: number; query: Record<string, unknown>; rows: number; credits_used: number; created_at: string }[];
  counts: { unlocked: number; lists: number };
}
