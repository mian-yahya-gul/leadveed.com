import { forward } from "../_proxy";
export async function GET() { return forward("/v1/me/lists", "GET"); }
export async function POST(req: Request) { return forward("/v1/me/lists", "POST", await req.json()); }
