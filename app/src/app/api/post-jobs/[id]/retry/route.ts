import { requeueJob } from "@/server/jobs/job-service";
import { startJobRunner } from "@/server/jobs/job-runner";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await requeueJob(id);
    startJobRunner();
    return Response.json({ id, status: "queued" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 400 });
  }
}
