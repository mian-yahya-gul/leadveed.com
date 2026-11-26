import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Data sources and licences", description: "Where LeadVeed's business data comes from, how it is licensed, merged and scored." };

export default function DataLicensing() {
  return (
    <LegalPage eyebrow="Our data" title="Data sources and licences" updated="26 November 2026">
      <p>
        LeadVeed is built entirely from open datasets that allow commercial use. We don&apos;t scrape websites that forbid it, and we don&apos;t buy data from brokers.
        This page explains where each record comes from, what we do to it, and the attribution the licences ask for.
      </p>

      <h2>Sources</h2>
      <h3>Overture Maps Foundation — Places</h3>
      <p>
        The Overture Maps Foundation publishes a global dataset of points of interest every month, assembled from contributions by its members and other open sources.
        Each record carries a confidence score and the upstream datasets it came from.
      </p>
      <ul>
        <li>Licence: <a href="https://cdla.dev/permissive-2-0/" target="_blank" rel="noreferrer">Community Data License Agreement – Permissive, Version 2.0</a> (CDLA-Permissive-2.0).</li>
        <li>Attribution: <i>&ldquo;© OpenStreetMap contributors, Overture Maps Foundation&rdquo;</i> where OpenStreetMap-derived records are included, and <i>&ldquo;Overture Maps Foundation&rdquo;</i> for the places theme. See <a href="https://docs.overturemaps.org/attribution/" target="_blank" rel="noreferrer">Overture&apos;s attribution guidance</a>.</li>
        <li>Website: <a href="https://overturemaps.org" target="_blank" rel="noreferrer">overturemaps.org</a></li>
      </ul>
      <h3>All The Places</h3>
      <p>
        All The Places runs open-source spiders over brands&apos; own public store locators every week, so its records for chains and franchises come straight from the business.
      </p>
      <ul>
        <li>Licence: <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noreferrer">CC0 1.0 Universal (public domain dedication)</a>.</li>
        <li>Website: <a href="https://www.alltheplaces.xyz" target="_blank" rel="noreferrer">alltheplaces.xyz</a></li>
      </ul>
      <h3>Google PageSpeed Insights</h3>
      <p>Website speed scores are measured with Google&apos;s public PageSpeed Insights API against each business&apos;s own homepage.</p>

      <h2>How we process it</h2>
      <ul>
        <li><b>Monthly import.</b> Each new Overture release and the latest All The Places run are downloaded automatically.</li>
        <li><b>Clean-up.</b> Names, phone numbers and website domains are normalised; social links are separated from real websites; closed places and non-business features are dropped; city names are reconciled across scripts and spellings.</li>
        <li><b>De-duplication and merging.</b> Records within a few hundred metres are matched by phone number, by website domain plus a similar name, or by a near-identical name. Matched records become one lead, combining the most reliable fields from each source.</li>
        <li><b>Stable ids.</b> A lead keeps its LeadVeed id across releases, so unlocks and lists survive updates. Businesses missing from two releases in a row are removed.</li>
      </ul>

      <h2 id="quality">The quality score</h2>
      <p>Every lead gets a score from 0 to 100, shown before you spend a credit:</p>
      <ul>
        <li>Source confidence, up to 25 points</li>
        <li>Phone number present, 15 points</li>
        <li>The business&apos;s own website (not just a social page), 17 points</li>
        <li>Email address, 8 points</li>
        <li>Street, city and postcode, up to 12 points</li>
        <li>Confirmed by two or more independent sources, 12 points</li>
        <li>Social profiles, 5 points; category, 3 points; updated within the last year, 3 points</li>
        <li>Marked temporarily closed by a source, minus 20 points</li>
      </ul>
      <p>Grades: A is 75 and above, B is 55 to 74, C is 35 to 54, D is below 35.</p>

      <h2>Your rights over the data</h2>
      <p>
        If you run a business listed here and want it removed, use <Link href="/remove-my-data">Remove my data</Link>. After you confirm by email we delete the listing and add it to a suppression list, so later imports don&apos;t bring it back.
        Corrections are best made at the source (for example by updating your OpenStreetMap entry or your store locator), and they flow into LeadVeed with the next release.
      </p>
      <h2>Your obligations as a customer</h2>
      <p>
        Leads you export inherit the licences above. Keep the attribution when you redistribute the data, and follow the marketing and privacy laws that apply to you,
        such as consent rules for email and messaging and do-not-call registers. See our <Link href="/terms">terms</Link>.
      </p>
    </LegalPage>
  );
}
