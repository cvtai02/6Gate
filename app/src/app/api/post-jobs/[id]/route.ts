import { deleteJob, getJob } from "@/server/jobs/job-service";
import { getJobLogs } from "@/server/jobs/log-service";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const [job, logs] = await Promise.all([getJob(id), getJobLogs(id)]);
  if (!job) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ...job, logs });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) return Response.json({ error: "Not found" }, { status: 404 });
  await deleteJob(id);
  return new Response(null, { status: 204 });
}
