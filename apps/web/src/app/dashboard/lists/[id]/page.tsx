import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { Header } from "@/components/Header";
import { ResultsTable } from "@/components/ResultsTable";
import { api, safe } from "@/lib/api";
import type { Lead } from "@/lib/types";

export default async function ListPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await auth())?.user) redirect("/login?next=/dashboard");
  const { id } = await params;
  const data = await safe(api<{ list: { id: number; name: string }; leads: Lead[] }>(`/v1/me/lists/${encodeURIComponent(id)}`));
  if (!data) notFound();
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6">
        <Link href="/dashboard#lists" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"><ArrowLeft className="h-4 w-4" /> Dashboard</Link>
        <h1 className="mt-4 text-3xl font-extrabold text-ink-950">{data.list.name}</h1>
        <p className="mb-6 mt-1 text-ink-500">{data.leads.length} leads</p>
        {data.leads.length ? <ResultsTable initial={data.leads} signedIn query={{}} found={data.leads.length} /> : <p className="text-ink-500">This list is empty.</p>}
      </main>
    </>
  );
}
