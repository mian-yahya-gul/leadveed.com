import { NextResponse } from "next/server";
import { api, ApiError, currentUserId } from "@/lib/api";

/** Forward a JSON request to the API as the signed-in user. */
export async function forward(path: string, method: string, body?: unknown) {
  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ error: "sign_in_required" }, { status: 401 });
  try {
    const data = await api(path, { method, userId: uid, body: body === undefined ? undefined : JSON.stringify(body) });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof ApiError) return NextResponse.json(e.body ?? { error: "api_error" }, { status: e.status });
    return NextResponse.json({ error: "api_unreachable" }, { status: 502 });
  }
}
