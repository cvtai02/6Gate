import { CreateJobSchema, createJob, listJobs } from "@/server/jobs/job-service";
import { startJobRunner } from "@/server/jobs/job-runner";

export const dynamic = "force-dynamic";

startJobRunner();

export async function GET() {
  const jobs = await listJobs();
  return Response.json(jobs);
}

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = CreateJobSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }

  try {
    const job = await createJob(parsed.data);
    return Response.json(job, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 400 });
  }
}
