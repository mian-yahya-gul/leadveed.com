import { forward } from "../../../_proxy";
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return forward(`/v1/me/lists/${encodeURIComponent(id)}/items`, "POST", await req.json());
}
