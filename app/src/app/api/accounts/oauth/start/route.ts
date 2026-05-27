import { z } from "zod";
import { startOAuth } from "@/server/auth/oauth-service";

export const dynamic = "force-dynamic";

const Schema = z.object({ providerId: z.string() });

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }

  try {
    const url = await startOAuth(parsed.data.providerId);
    return Response.json({ url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 400 });
  }
}
