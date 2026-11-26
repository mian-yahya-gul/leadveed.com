// Keep in step with apps/api/src/plans.ts (the API is the source of truth for credits).
export const PLANS = [
  {
    id: "free", name: "Free", price: 0, credits: 25, blurb: "Try the data on your own market.",
    features: ["25 lead unlocks", "Every search filter", "Quality score on every lead", "CSV export"],
  },
  {
    id: "starter", name: "Starter", price: 19, credits: 1000, blurb: "For freelancers and solo founders.",
    features: ["1,000 lead unlocks / month", "PageSpeed website scores", "Saved lists and searches", "Unused credits roll over a month"],
  },
  {
    id: "pro", name: "Pro", price: 49, credits: 5000, blurb: "For agencies prospecting every week.", popular: true,
    features: ["5,000 lead unlocks / month", "Everything in Starter", "New-business alerts (soon)", "Priority website checks", "2 seats"],
  },
  {
    id: "agency", name: "Agency", price: 99, credits: 15000, blurb: "For teams running outbound at scale.",
    features: ["15,000 lead unlocks / month", "Everything in Pro", "5 team seats", "API access (soon)"],
  },
] as const;

export type PlanId = (typeof PLANS)[number]["id"];

/** Rough display conversions; billing is always in USD. Update now and then. */
export const CURRENCIES = {
  USD: { symbol: "$", rate: 1 },
  PKR: { symbol: "Rs ", rate: 280 },
  AED: { symbol: "AED ", rate: 3.67 },
  SAR: { symbol: "SAR ", rate: 3.75 },
  GBP: { symbol: "£", rate: 0.79 },
} as const;
export type Currency = keyof typeof CURRENCIES;
