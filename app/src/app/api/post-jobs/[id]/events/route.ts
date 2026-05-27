import { subscribeToJob, getJobLogs } from "@/server/jobs/log-service";
import { getJob } from "@/server/jobs/job-service";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const job = await getJob(id);
  if (!job) return Response.json({ error: "Not found" }, { status: 404 });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const pastLogs = await getJobLogs(id);
      for (const log of pastLogs) {
        const msg = `event: log\ndata: ${JSON.stringify({ level: log.level, message: log.message, createdAt: log.createdAt })}\n\n`;
        controller.enqueue(encoder.encode(msg));
      }

      const currentJob = await getJob(id);
      if (currentJob && ["completed", "failed", "cancelled"].includes(currentJob.status)) {
        const msg = `event: status\ndata: ${JSON.stringify({ status: currentJob.status })}\n\n`;
        controller.enqueue(encoder.encode(msg));
        controller.close();
        return;
      }

      const unsubscribe = subscribeToJob(id, (event) => {
        try {
          controller.enqueue(encoder.encode(event));
          if (event.includes("event: status") && (event.includes('"completed"') || event.includes('"failed"') || event.includes('"cancelled"'))) {
            unsubscribe();
            controller.close();
          }
        } catch {
          unsubscribe();
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
