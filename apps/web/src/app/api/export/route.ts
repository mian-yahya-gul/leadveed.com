import { NextResponse } from "next/server";
import { api, currentUserId } from "@/lib/api";

export async function POST(req: Request) {
  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ error: "sign_in_required" }, { status: 401 });
  const body = await req.json();
  const res = await api<Response>("/v1/export", { method: "POST", userId: uid, body: JSON.stringify(body), raw: true });
  const headers = new Headers();
  for (const h of ["content-type", "content-disposition", "x-credits-charged", "x-credits-balance"]) {
    const v = res.headers.get(h);
    if (v) headers.set(h, v);
  }
  return new NextResponse(res.body, { status: res.status, headers });
}
