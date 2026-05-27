import { writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { nanoid } from "nanoid";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return Response.json({ error: "No file provided" }, { status: 400 });

  const ext = file.name.slice(file.name.lastIndexOf(".")) || ".mp4";
  const tmpPath = join(tmpdir(), `6gate_${nanoid(8)}${ext}`);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(tmpPath, buffer);

  return Response.json({ path: tmpPath });
}
