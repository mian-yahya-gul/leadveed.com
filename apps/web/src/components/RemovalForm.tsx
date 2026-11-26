"use client";
import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

export function RemovalForm({ lead }: { lead?: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  if (state === "sent") {
    return (
      <div className="card p-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
        <h2 className="mt-4 text-xl font-bold text-ink-950">Check your inbox</h2>
        <p className="mt-2 text-sm text-ink-500">We sent a confirmation link. The listing is removed as soon as you click it.</p>
      </div>
    );
  }
  return (
    <form className="card space-y-5 p-8" onSubmit={async (e) => {
      e.preventDefault();
      setState("sending");
      const fd = new FormData(e.currentTarget);
      const r = await fetch("/api/removal", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: fd.get("email"), placeUrl: fd.get("placeUrl") || undefined, businessName: fd.get("businessName") || undefined, message: fd.get("message") || undefined }) });
      setState(r.ok ? "sent" : "error");
    }}>
      <div><label className="label" htmlFor="placeUrl">LeadVeed page of the listing</label>
        <input id="placeUrl" name="placeUrl" className="input" placeholder="https://leadveed.com/lead/lv_…" defaultValue={lead ? `https://leadveed.com/lead/${lead}` : ""} /></div>
      <div><label className="label" htmlFor="businessName">Or the business name and city</label>
        <input id="businessName" name="businessName" className="input" placeholder="e.g. Al Noor Dental Clinic, Karachi" /></div>
      <div><label className="label" htmlFor="email">Your email</label>
        <input id="email" name="email" type="email" required className="input" placeholder="you@business.com" /></div>
      <div><label className="label" htmlFor="message">Anything else? (optional)</label>
        <textarea id="message" name="message" rows={3} className="input" /></div>
      {state === "error" && <p className="text-sm text-rose-600">Please add the listing link or the business name, and a valid email.</p>}
      <button className="btn-primary w-full py-3" disabled={state === "sending"}>{state === "sending" && <Loader2 className="h-4 w-4 animate-spin" />} Send removal request</button>
      <p className="text-xs leading-5 text-ink-400">Requests with a listing link are processed automatically when you confirm. Name-only requests are reviewed by a person within 5 working days.</p>
    </form>
  );
}
