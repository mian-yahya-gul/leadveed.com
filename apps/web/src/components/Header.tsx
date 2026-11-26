import Link from "next/link";
import { Coins, LayoutDashboard } from "lucide-react";
import { auth } from "@/auth";
import { getMe } from "@/lib/api";
import { nf } from "@/lib/format";
import { Logo } from "./Logo";
import { UserMenu } from "./UserMenu";

export async function Header({ dark = false }: { dark?: boolean }) {
  const session = await auth();
  const me = session?.user ? await getMe() : null;
  const link = dark ? "text-ink-200 hover:text-white" : "text-ink-600 hover:text-ink-950";
  return (
    <header className={`sticky top-0 z-40 ${dark ? "bg-ink-950/80 border-white/5" : "bg-white/85 border-ink-100"} border-b backdrop-blur-xl`}>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-8 px-4 sm:px-6">
        <Logo dark={dark} />
        <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
          <Link href="/search" className={link}>Search leads</Link>
          <Link href="/pricing" className={link}>Pricing</Link>
          <Link href="/data-licensing" className={link}>Our data</Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {session?.user ? (
            <>
              <Link href="/pricing" title="Credits left"
                className={`hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold sm:inline-flex ${dark ? "bg-white/10 text-white" : "bg-signal-300/60 text-ink-900"}`}>
                <Coins className="h-3.5 w-3.5" /> {nf.format(me?.user.credits ?? 0)} credits
              </Link>
              <Link href="/dashboard" className={`btn-ghost btn-sm hidden sm:inline-flex ${dark ? "text-ink-100 hover:bg-white/10" : ""}`}>
                <LayoutDashboard className="h-4 w-4" /> Dashboard
              </Link>
              <UserMenu name={session.user.name ?? session.user.email ?? ""} image={session.user.image ?? null} dark={dark} />
            </>
          ) : (
            <>
              <Link href="/login" className={`btn-ghost ${dark ? "text-ink-100 hover:bg-white/10" : ""}`}>Sign in</Link>
              <Link href="/login?signup=1" className="btn-primary">Get 25 free leads</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
