import { Footer } from "./Footer";
import { Header } from "./Header";

export function LegalPage({ eyebrow, title, updated, children }: { eyebrow: string; title: string; updated: string; children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-16 sm:px-6">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-3 text-4xl font-extrabold text-ink-950">{title}</h1>
        <p className="mt-3 text-sm text-ink-400">Last updated {updated}</p>
        <div className="prose-legal mt-10">{children}</div>
      </main>
      <Footer />
    </>
  );
}
