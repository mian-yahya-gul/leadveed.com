import Link from "next/link";
import { Header } from "@/components/Header";

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <p className="font-display text-7xl font-extrabold text-brand-200">404</p>
        <h1 className="mt-4 text-2xl font-extrabold text-ink-950">We couldn&apos;t find that page</h1>
        <p className="mt-2 text-ink-500">The business may have closed or asked to be removed.</p>
        <Link href="/search" className="btn-primary mt-8">Search leads</Link>
      </main>
    </>
  );
}
