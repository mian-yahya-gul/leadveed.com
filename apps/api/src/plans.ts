export type PlanId = "free" | "starter" | "pro" | "agency";

export interface Plan {
  id: PlanId;
  name: string;
  priceUsd: number;
  /** Credits added each billing month (free: once, at sign-up). 1 credit = 1 lead unlocked. */
  credits: number;
  maxExportRows: number;
  seats: number;
  features: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free", name: "Free", priceUsd: 0, credits: 25, maxExportRows: 25, seats: 1,
    features: ["25 lead unlocks", "Full search and filters", "CSV export", "Quality scores"],
  },
  starter: {
    id: "starter", name: "Starter", priceUsd: 19, credits: 1000, maxExportRows: 1000, seats: 1,
    features: ["1,000 lead unlocks a month", "PageSpeed scores", "Saved lists", "Unused credits roll over 1 month"],
  },
  pro: {
    id: "pro", name: "Pro", priceUsd: 49, credits: 5000, maxExportRows: 5000, seats: 2,
    features: ["5,000 lead unlocks a month", "Everything in Starter", "New-business alerts", "Priority PageSpeed checks"],
  },
  agency: {
    id: "agency", name: "Agency", priceUsd: 99, credits: 15000, maxExportRows: 15000, seats: 5,
    features: ["15,000 lead unlocks a month", "Everything in Pro", "5 team seats", "API access"],
  },
};

/** Paddle price ids for each paid plan (live catalog). PADDLE_PRICE_STARTER etc override them, e.g. for sandbox. */
const DEFAULT_PRICES: Record<Exclude<PlanId, "free">, string> = {
  starter: "pri_01m8ees1p0pvzk6ka0t2ydtnv3",
  pro: "pri_01m8eet8q6gp33efa2deyr68ch",
  agency: "pri_01m8eevd7fg5mpj06690rtk0zz",
};

export function priceIdFor(plan: Exclude<PlanId, "free">): string {
  return process.env[`PADDLE_PRICE_${plan.toUpperCase()}`] || DEFAULT_PRICES[plan];
}

/** Paddle price id -> plan. */
export function planForPrice(priceId: string | undefined | null): PlanId | null {
  if (!priceId) return null;
  for (const id of ["starter", "pro", "agency"] as const) {
    if (priceIdFor(id) === priceId) return id;
  }
  return null;
}
