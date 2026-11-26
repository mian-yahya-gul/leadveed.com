# Roadmap

## Phase 1 (this release)
- [x] Monthly import of Overture Maps + All The Places, merge, dedupe, quality score
- [x] Search by country, city, industry, business type, keyword, website / no website, phone, email, socials, quality, slow website, new businesses, map view
- [x] Lead pages with contact details, map, quality breakdown, PageSpeed score, sources, similar businesses
- [x] Accounts (Google, email link), credits, unlock once / re-export free, CSV export with cost preview, lists
- [x] Pricing with Lemon Squeezy subscriptions and local-currency display
- [x] Data licensing, privacy, terms, "remove my data" with email confirmation and suppression
- [x] Oracle server setup, nightly import timer, PageSpeed worker, R2 backups, CI and deploys

## Phase 2
- Email finder: crawl each business's own website (contact/about pages, respecting robots.txt), then verify with MX + SMTP checks
- AI website audit and personalised cold-email pitch (Claude API), as a paid add-on
- Tech stack detection (CMS, analytics, ads pixels, booking tools) from the homepage
- Built-in email and WhatsApp outreach sequences
- New-business alerts on saved searches (the `saved_searches.alert` column is ready)
- Deeper Pakistan and Gulf coverage: local business registries and chambers of commerce where the licence allows
- Pricing in PKR / AED / SAR at checkout
- SEO landing pages per city × category (e.g. /pk/lahore/dental-clinics)
- Team seats and API keys for Agency
