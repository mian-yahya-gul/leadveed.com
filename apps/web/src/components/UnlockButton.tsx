"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Unlock } from "lucide-react";

export function UnlockButton({ id, signedIn, className = "btn-primary w-full py-3" }: { id: string; signedIn: boolean; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <button className={className} disabled={busy} onClick={async () => {
        if (!signedIn) return router.push(`/login?signup=1&next=${encodeURIComponent(`/lead/${id}`)}`);
        setBusy(true); setErr(null);
        const r = await fetch("/api/unlock", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: [id] }) });
        setBusy(false);
        if (r.status === 402) return setErr("You're out of credits.");
        if (!r.ok) return setErr("Something went wrong.");
        router.refresh();
      }}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlock className="h-4 w-4" />}
        {signedIn ? "Unlock contact details · 1 credit" : "Sign up free to unlock"}
      </button>
      {err && <p className="mt-2 text-center text-sm text-rose-600">{err} <a href="/pricing" className="font-semibold underline">Get more credits</a></p>}
    </div>
  );
}
