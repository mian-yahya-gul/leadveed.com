import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isPaidPlan } from "@/lib/plans";

/** Send a signed-in user to the checkout page for a plan (signing in first if needed). */
export async function GET(req: NextRequest) {
  const plan = req.nextUrl.searchParams.get("plan") ?? "";
  if (!isPaidPlan(plan)) return NextResponse.redirect(new URL("/pricing?error=checkout", req.url));
  const session = await auth();
  const uid = (session?.user as { id?: string } | undefined)?.id;
  if (!uid) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(`/api/checkout?plan=${plan}`)}`, req.url));
  return NextResponse.redirect(new URL(`/checkout?plan=${plan}`, req.url));
}
