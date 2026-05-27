import { nanoid } from "nanoid";
import { getDb } from "@/server/db";
import { providers } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const CreateProviderSchema = z.object({
  name: z.string(),
  type: z.string(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  authUrl: z.string().optional(),
  tokenUrl: z.string().optional(),
  scopes: z.array(z.string()).optional(),
});

export async function GET() {
  const db = getDb();
  const rows = await db
    .select()
    .from(providers)
    .orderBy(desc(providers.createdAt))
    .all();
  return Response.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = CreateProviderSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }

  const data = parsed.data;
  const db = getDb();

  const existing = await db.select({ id: providers.id }).from(providers).where(eq(providers.type, data.type)).get();
  if (existing) {
    return Response.json({ error: `A ${data.type} app is already configured. Edit or remove it first.` }, { status: 409 });
  }

  const now = new Date().toISOString();
  const id = `prov_${nanoid(10)}`;

  await db.insert(providers).values({
    id,
    name: data.name,
    type: data.type,
    clientId: data.clientId ?? null,
    clientSecret: data.clientSecret ?? null,
    authUrl: data.authUrl ?? null,
    tokenUrl: data.tokenUrl ?? null,
    scopes: data.scopes ? data.scopes.join(",") : null,
    createdAt: now,
  });

  const row = await db.select().from(providers).where(eq(providers.id, id)).get();
  return Response.json(row, { status: 201 });
}
