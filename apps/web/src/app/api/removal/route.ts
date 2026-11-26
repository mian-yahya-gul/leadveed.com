import { NextResponse } from "next/server";
import { api, ApiError } from "@/lib/api";
export async function POST(req: Request) {
  try {
    return NextResponse.json(await api("/v1/removal", { method: "POST", userId: null, body: JSON.stringify(await req.json()) }));
  } catch (e) {
    return NextResponse.json({ error: "failed" }, { status: e instanceof ApiError ? e.status : 502 });
  }
}
