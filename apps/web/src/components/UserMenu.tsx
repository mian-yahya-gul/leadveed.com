"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LogOut, Settings, List, CreditCard } from "lucide-react";

export function UserMenu({ name, image, dark }: { name: string; image: string | null; dark?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);
  const initials = name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label="Account menu"
        className={`grid h-9 w-9 place-items-center overflow-hidden rounded-full text-xs font-bold ring-2 ${dark ? "bg-brand-600 text-white ring-white/10" : "bg-brand-100 text-brand-800 ring-white"}`}>
        {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : initials || "U"}
      </button>
      {open && (
        <div className="card absolute right-0 mt-2 w-56 overflow-hidden p-1.5 text-sm animate-fade-up">
          <div className="truncate px-3 py-2 text-xs text-ink-500">{name}</div>
          <Link href="/dashboard" className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-ink-50"><Settings className="h-4 w-4" /> Dashboard</Link>
          <Link href="/dashboard#lists" className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-ink-50"><List className="h-4 w-4" /> My lists</Link>
          <Link href="/pricing" className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-ink-50"><CreditCard className="h-4 w-4" /> Plans and credits</Link>
          <form action="/api/auth/signout" method="post">
            <SignOutButton />
          </form>
        </div>
      )}
    </div>
  );
}

function SignOutButton() {
  // Auth.js needs its CSRF token for POST sign-out; fetch it on click.
  return (
    <button type="button" onClick={async () => {
      const { csrfToken } = await fetch("/api/auth/csrf").then((r) => r.json());
      await fetch("/api/auth/signout", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ csrfToken, callbackUrl: "/" }) });
      window.location.href = "/";
    }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-rose-600 hover:bg-rose-50">
      <LogOut className="h-4 w-4" /> Sign out
    </button>
  );
}
