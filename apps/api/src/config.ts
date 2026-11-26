function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === "") throw new Error(`Missing required env var ${name}`);
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  host: process.env.HOST ?? "127.0.0.1",
  databaseUrl: req("DATABASE_URL", "postgresql://leadveed:devpass@localhost/leadveed"),
  /** Shared secret between the Next.js server and this API. The browser never sees it. */
  internalKey: req("INTERNAL_API_KEY", process.env.NODE_ENV === "production" ? undefined : "dev-internal-key"),
  typesenseUrl: process.env.TYPESENSE_URL ?? "",
  typesenseKey: process.env.TYPESENSE_API_KEY ?? "",
  /** Countries held in Typesense (fast search). Empty = all. Other countries are searched in Postgres. */
  typesenseCountries: (process.env.TYPESENSE_COUNTRIES ?? "").split(",").map((c) => c.trim().toUpperCase()).filter(Boolean),
  siteUrl: process.env.SITE_URL ?? "http://localhost:3000",
  resendKey: process.env.RESEND_API_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "LeadVeed <hello@leadveed.com>",
  pagespeedKey: process.env.PAGESPEED_API_KEY ?? "",
  pagespeedDailyBudget: Number(process.env.PAGESPEED_DAILY_BUDGET ?? 20000),
  lemonSigningSecret: process.env.LEMONSQUEEZY_WEBHOOK_SECRET ?? "",
  /** Anonymous visitors can page through this many results before being asked to sign up. */
  anonMaxPages: Number(process.env.ANON_MAX_PAGES ?? 3),
};
