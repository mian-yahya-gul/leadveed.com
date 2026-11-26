import { forward } from "../_proxy";
export async function POST(req: Request) {
  return forward("/v1/leads/unlock", "POST", await req.json());
}
