import { join } from "path";
import { tmpdir } from "os";
import { writeFile } from "fs/promises";
import { nanoid } from "nanoid";
import { getDb } from "@/server/db";
import { groupDestinations, publishDestinations, accounts, providers } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { createJob } from "@/server/jobs/job-service";
import { startJobRunner } from "@/server/jobs/job-runner";

export const dynamic = "force-dynamic";

startJobRunner();

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: groupId } = await params;

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return Response.json(
      {
        error: "This endpoint requires multipart/form-data (with a 'video' file field). " +
          "If you want to reference a video by absolute path on disk, POST JSON to /api/groups/{id}/upload-by-path instead.",
        receivedContentType: contentType || null,
      },
      { status: 400 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return Response.json({ error: "Failed to parse multipart form data", detail }, { status: 400 });
  }

  const file = formData.get("video") as File | null;
  if (!file || typeof file === "string") {
    return Response.json({ error: "video file is required" }, { status: 400 });
  }

  const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : ".mp4";
  const videoPath = join(tmpdir(), `6gate_${nanoid(8)}${ext}`);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(videoPath, buffer);

  const title = (formData.get("title") as string | null) ?? undefined;
  const caption = (formData.get("caption") as string | null) ?? undefined;
  const privacy = (formData.get("privacy") as string | null) as "private" | "public" | "unlisted" | undefined;

  const db = getDb();

  const links = await db
    .select({ destinationId: groupDestinations.destinationId })
    .from(groupDestinations)
    .where(eq(groupDestinations.groupId, groupId))
    .all();

  if (links.length === 0) {
    return Response.json({ error: "Group has no destinations" }, { status: 400 });
  }

  const jobs: { id: string; destinationId: string; destinationName: string; platform: string }[] = [];

  for (const { destinationId } of links) {
    const dest = await db
      .select()
      .from(publishDestinations)
      .where(eq(publishDestinations.id, destinationId))
      .get();
    if (!dest) continue;

    const account = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, dest.socialAccountId))
      .get();
    if (!account) continue;

    const provider = await db
      .select()
      .from(providers)
      .where(eq(providers.id, account.providerId))
      .get();
    if (!provider) continue;

    const job = await createJob({ accountId: account.id, destinationId, videoPath, title, caption, privacy });
    jobs.push({ id: job.id, destinationId, destinationName: dest.name, platform: provider.type });
  }

  return Response.json({ groupId, jobs });
}
