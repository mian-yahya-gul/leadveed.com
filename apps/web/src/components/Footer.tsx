import Link from "next/link";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-ink-100 bg-ink-50/60">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-sm text-sm leading-6 text-ink-500">
            B2B leads built from open, licensed business data, merged, de-duplicated and scored so you spend time selling, not cleaning lists.
          </p>
        </div>
        <FooterCol title="Product" links={[["Search leads", "/search"], ["Pricing", "/pricing"], ["Dashboard", "/dashboard"]]} />
        <FooterCol title="Data" links={[["Data sources and licences", "/data-licensing"], ["Remove my data", "/remove-my-data"], ["Data quality score", "/data-licensing#quality"]]} />
        <FooterCol title="Legal" links={[["Privacy policy", "/privacy"], ["Terms of service", "/terms"]]} />
      </div>
      <div className="border-t border-ink-100">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs leading-5 text-ink-500 sm:px-6 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} LeadVeed. All rights reserved.</p>
          <p>
            Contains data from{" "}
            <a className="underline decoration-ink-300 underline-offset-2 hover:text-ink-800" href="https://overturemaps.org" target="_blank" rel="noreferrer">Overture Maps Foundation</a>{" "}
            (<a className="underline decoration-ink-300 underline-offset-2 hover:text-ink-800" href="https://cdla.dev/permissive-2-0/" target="_blank" rel="noreferrer">CDLA Permissive 2.0</a>)
            {" "}and{" "}
            <a className="underline decoration-ink-300 underline-offset-2 hover:text-ink-800" href="https://www.alltheplaces.xyz" target="_blank" rel="noreferrer">All The Places</a>{" "}
            (<a className="underline decoration-ink-300 underline-offset-2 hover:text-ink-800" href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noreferrer">CC0</a>).{" "}
            <Link href="/data-licensing" className="underline decoration-ink-300 underline-offset-2 hover:text-ink-800">Details</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-ink-900">{title}</h3>
      <ul className="mt-4 space-y-2.5 text-sm">
        {links.map(([label, href]) => (
          <li key={href}><Link href={href} className="text-ink-500 hover:text-ink-900">{label}</Link></li>
        ))}
      </ul>
    </div>
  );
}
