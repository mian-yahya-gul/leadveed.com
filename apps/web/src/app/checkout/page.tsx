import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Logo } from "@/components/Logo";
import { PaddleCheckout } from "@/components/PaddleCheckout";
import { PLANS, isPaidPlan, paddlePriceId } from "@/lib/plans";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

type SP = Promise<{ plan?: string }>;

/**
 * Paddle's overlay checkout. This page's URL is the "default payment link" in
 * Paddle -> Checkout -> Checkout settings, so its domain must be approved there.
 */
export default async function Checkout({ searchParams }: { searchParams: SP }) {
  const { plan = "" } = await searchParams;
  if (!isPaidPlan(plan)) redirect("/pricing");
  const session = await auth();
  const uid = (session?.user as { id?: string } | undefined)?.id;
  if (!uid) redirect(`/login?next=${encodeURIComponent(`/checkout?plan=${plan}`)}`);

  const token = process.env.PADDLE_CLIENT_TOKEN ?? "";
  const details = PLANS.find((p) => p.id === plan)!;
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://leadveed.com";

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col px-6 py-10">
      <Logo />
      <div className="my-auto py-16 text-center">
        <h1 className="text-3xl font-extrabold text-ink-950">{details.name} plan</h1>
        <p className="mt-2 text-ink-500">${details.price} a month · {details.credits.toLocaleString("en-US")} lead unlocks every month. Cancel any time.</p>
        {token ? (
          <PaddleCheckout
            token={token}
            sandbox={process.env.PADDLE_ENV === "sandbox"}
            priceId={paddlePriceId(plan)}
            email={session?.user?.email ?? undefined}
            userId={uid}
            successUrl={`${site}/dashboard?upgraded=1`}
          />
        ) : (
          <p className="mt-8 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">Checkout isn&apos;t switched on yet. Please try again soon.</p>
        )}
        <p className="mt-8 text-xs text-ink-400">Payments are handled by Paddle, our merchant of record. Your order is with Paddle.com, which also handles tax and invoices.</p>
      </div>
    </main>
  );
}
