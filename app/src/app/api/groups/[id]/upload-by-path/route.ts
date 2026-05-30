import { existsSync } from "fs";
import { getDb } from "@/server/db";
import { groupDestinations, publishDestinations, accounts, providers } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { createJob } from "@/server/jobs/job-service";
import { startJobRunner } from "@/server/jobs/job-runner";
import { getDestinationIconUrl } from "@/lib/destination-icons";

export const dynamic = "force-dynamic";

startJobRunner();

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: groupId } = await params;

  let body: { videoPath?: string; title?: string; caption?: string; privacy?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { videoPath, title, caption, privacy } = body;

  if (!videoPath) {
    return Response.json({ error: "videoPath is required" }, { status: 400 });
  }

  if (!existsSync(videoPath)) {
    return Response.json({ error: `File not found: ${videoPath}` }, { status: 400 });
  }

  const db = getDb();

  const links = await db
    .select({ destinationId: groupDestinations.destinationId })
    .from(groupDestinations)
    .where(eq(groupDestinations.groupId, groupId))
    .all();

  if (links.length === 0) {
    return Response.json({ error: "Group has no destinations" }, { status: 400 });
  }

  const jobs: {
    id: string;
    destinationId: string;
    destinationName: string;
    destinationIcon: string | null;
    platform: string;
    jobDetailsLink: string;
    jobEventsLink: string;
    jobCancelLink: string;
  }[] = [];

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

    const job = await createJob({
      accountId: account.id,
      destinationId,
      videoPath,
      title,
      caption,
      privacy: privacy as "private" | "public" | "unlisted" | undefined,
    });
    jobs.push({
      id: job.id,
      destinationId,
      destinationName: dest.name,
      destinationIcon: getDestinationIconUrl(req.url, dest.type, provider.type),
      platform: provider.type,
      jobDetailsLink: new URL(`/jobs/${job.id}`, req.url).toString(),
      jobEventsLink: new URL(`/api/post-jobs/${job.id}/events`, req.url).toString(),
      jobCancelLink: new URL(`/api/post-jobs/${job.id}/cancel`, req.url).toString(),
    });
  }

  return Response.json({ groupId, jobs });
}
