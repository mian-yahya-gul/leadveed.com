import { forward } from "../_proxy";
export async function POST(req: Request) { return forward("/v1/me/searches", "POST", await req.json()); }
