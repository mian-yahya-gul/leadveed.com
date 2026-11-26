import { NextRequest, NextResponse } from "next/server";
import { api } from "@/lib/api";

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString();
  try {
    const data = await api(`/v1/suggest?${qs}`, { userId: null });
    return NextResponse.json(data, { headers: { "cache-control": "public, max-age=300" } });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
