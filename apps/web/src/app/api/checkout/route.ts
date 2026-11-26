import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

/** Send a signed-in user to the Lemon Squeezy hosted checkout for a plan. */
export async function GET(req: NextRequest) {
  const plan = req.nextUrl.searchParams.get("plan") ?? "";
  const session = await auth();
  const uid = (session?.user as { id?: string } | undefined)?.id;
  if (!uid) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(`/api/checkout?plan=${plan}`)}`, req.url));
  const base = process.env[`LS_CHECKOUT_${plan.toUpperCase()}`];
  if (!base || !["starter", "pro", "agency"].includes(plan)) return NextResponse.redirect(new URL("/pricing?error=checkout", req.url));
  const url = new URL(base);
  url.searchParams.set("checkout[custom][user_id]", uid);
  if (session?.user?.email) url.searchParams.set("checkout[email]", session.user.email);
  return NextResponse.redirect(url);
}
