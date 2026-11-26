import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckCircle2, MailCheck } from "lucide-react";
import { auth, devLogin, enabledProviders, signIn } from "@/auth";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = { title: "Sign in" };

type SP = Promise<{ next?: string; signup?: string; sent?: string; error?: string }>;

function safeNext(n?: string) {
  return n && n.startsWith("/") && !n.startsWith("//") ? n : "/search";
}

export default async function Login({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if ((await auth())?.user) redirect(next);
  const signup = sp.signup === "1";

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-6 py-10 sm:px-12">
        <Logo />
        <div className="mx-auto my-auto w-full max-w-sm py-16">
          {sp.sent ? (
            <div className="text-center">
              <MailCheck className="mx-auto h-12 w-12 text-brand-600" />
              <h1 className="mt-5 text-2xl font-extrabold text-ink-950">Check your email</h1>
              <p className="mt-2 text-ink-500">We sent you a sign-in link. It works for 24 hours.</p>
            </div>
          ) : (
            <>
              <h1 className="text-3xl font-extrabold text-ink-950">{signup ? "Get 25 free leads" : "Welcome back"}</h1>
              <p className="mt-2 text-ink-500">{signup ? "Create your account in seconds. No card, no password." : "Sign in to search, unlock and export leads."}</p>
              {sp.error && <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">That didn't work. Please try again.</p>}
              <div className="mt-8 space-y-3">
                {enabledProviders.google && (
                  <form action={async () => { "use server"; await signIn("google", { redirectTo: next }); }}>
                    <button className="btn-outline w-full py-3">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.6 2.3 2.3 6.6 2.3 12s4.3 9.7 9.7 9.7c5.6 0 9.3-3.9 9.3-9.5 0-.6-.1-1.1-.2-1.6H12z" /></svg>
                      Continue with Google
                    </button>
                  </form>
                )}
                {enabledProviders.google && enabledProviders.email && (
                  <div className="flex items-center gap-3 py-2 text-xs text-ink-400"><span className="h-px flex-1 bg-ink-100" />or<span className="h-px flex-1 bg-ink-100" /></div>
                )}
                {enabledProviders.email && (
                  <form action={async (fd: FormData) => { "use server"; await signIn("resend", { email: String(fd.get("email")), redirectTo: next }); }} className="space-y-3">
                    <input name="email" type="email" required placeholder="you@company.com" className="input py-3" autoComplete="email" />
                    <button className="btn-primary w-full py-3">Email me a sign-in link</button>
                  </form>
                )}
                {devLogin && (
                  <form action={async (fd: FormData) => { "use server"; await signIn("dev", { email: String(fd.get("email")), redirectTo: next }); }} className="space-y-3 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4">
                    <p className="text-xs font-semibold text-amber-800">Local test sign-in (only on localhost)</p>
                    <input name="email" type="email" required defaultValue="demo@leadveed.test" className="input" />
                    <button className="btn-primary w-full">Sign in</button>
                  </form>
                )}
                {!enabledProviders.google && !enabledProviders.email && !devLogin && (
                  <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Sign-in isn't configured yet. Set AUTH_GOOGLE_ID or AUTH_RESEND_KEY.</p>
                )}
              </div>
              <p className="mt-8 text-xs leading-5 text-ink-400">By continuing you agree to our <a href="/terms" className="underline">terms</a> and <a href="/privacy" className="underline">privacy policy</a>.</p>
            </>
          )}
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-ink-950 p-12 text-white lg:flex lg:flex-col lg:justify-end">
        <div className="grid-bg absolute inset-0" />
        <div className="absolute -right-20 top-10 h-96 w-96 rounded-full bg-brand-600/40 blur-[100px]" />
        <div className="relative max-w-md">
          <h2 className="text-3xl font-extrabold leading-tight">Every business in your city, scored and ready to call.</h2>
          <ul className="mt-8 space-y-4 text-ink-200">
            {["25 free lead unlocks when you sign up", "Filter for businesses with no website or a slow one", "Quality score on every record before you pay", "Unlocked leads are yours to re-export forever"].map((t) => (
              <li key={t} className="flex gap-3"><CheckCircle2 className="h-5 w-5 shrink-0 text-signal-400" />{t}</li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
