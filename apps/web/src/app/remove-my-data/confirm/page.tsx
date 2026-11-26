import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { Header } from "@/components/Header";
import { api, safe } from "@/lib/api";

export default async function Confirm({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const r = token ? await safe(api<{ ok: boolean; status: string }>("/v1/removal/confirm", { method: "POST", userId: null, body: JSON.stringify({ token }) })) : null;
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-24 text-center">
        {r?.ok ? (
          <>
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
            <h1 className="mt-5 text-3xl font-extrabold text-ink-950">{r.status === "removed" ? "Listing removed" : "Request confirmed"}</h1>
            <p className="mt-3 text-ink-500">{r.status === "removed" ? "It's gone from LeadVeed and won't come back with future imports." : "Thanks. A person will find and remove the listing within 5 working days."}</p>
          </>
        ) : (
          <>
            <XCircle className="mx-auto h-14 w-14 text-rose-500" />
            <h1 className="mt-5 text-3xl font-extrabold text-ink-950">Link expired or already used</h1>
            <p className="mt-3 text-ink-500">If the listing is still visible, <Link className="font-semibold text-brand-700" href="/remove-my-data">send a new request</Link>.</p>
          </>
        )}
      </main>
    </>
  );
}
