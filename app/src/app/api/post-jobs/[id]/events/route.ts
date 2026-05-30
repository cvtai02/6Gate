import { getJobLogs } from "@/server/jobs/log-service";
import { getJob } from "@/server/jobs/job-service";

export const dynamic = "force-dynamic";

const TERMINAL_STATUSES = ["Published", "Failed", "Cancelled"] as const;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const job = await getJob(id);
  if (!job) return Response.json({ error: "Not found" }, { status: 404 });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let lastStatus = job.status;
      let poll: ReturnType<typeof setInterval> | null = null;
      let heartbeat: ReturnType<typeof setInterval> | null = null;
      const seenLogIds = new Set<string>();

      const safeEnqueue = (event: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(event));
        } catch {
          closed = true;
        }
      };

      const sendLog = (log: { id: string; level: string; message: string; createdAt: string }) => {
        seenLogIds.add(log.id);
        safeEnqueue(
          `event: log\ndata: ${JSON.stringify({
            level: log.level,
            message: log.message,
            createdAt: log.createdAt,
          })}\n\n`
        );
      };

      const sendStatus = (status: string, extra?: Record<string, unknown>) => {
        safeEnqueue(`event: status\ndata: ${JSON.stringify({ status, ...(extra ?? {}) })}\n\n`);
      };

      const close = () => {
        if (closed) return;
        closed = true;
        if (poll) clearInterval(poll);
        if (heartbeat) clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      for (const log of await getJobLogs(id)) {
        sendLog(log);
      }

      sendStatus(job.status, {
        providerPostId: job.providerPostId,
        providerPostUrl: job.providerPostUrl,
        errorMessage: job.errorMessage,
      });

      if ((TERMINAL_STATUSES as readonly string[]).includes(job.status)) {
        close();
        return;
      }

      poll = setInterval(async () => {
        try {
          const [logs, currentJob] = await Promise.all([getJobLogs(id), getJob(id)]);

          for (const log of logs) {
            if (!seenLogIds.has(log.id)) sendLog(log);
          }

          if (!currentJob) {
            sendStatus("Deleted");
            close();
            return;
          }

          if (currentJob.status !== lastStatus) {
            lastStatus = currentJob.status;
            sendStatus(currentJob.status, {
              providerPostId: currentJob.providerPostId,
              providerPostUrl: currentJob.providerPostUrl,
              errorMessage: currentJob.errorMessage,
            });
          }

          if ((TERMINAL_STATUSES as readonly string[]).includes(currentJob.status)) {
            close();
          }
        } catch (err) {
          safeEnqueue(
            `event: error\ndata: ${JSON.stringify({
              error: err instanceof Error ? err.message : String(err),
            })}\n\n`
          );
          close();
        }
      }, 1000);

      heartbeat = setInterval(() => {
        safeEnqueue(`: ping\n\n`);
      }, 25000);

      req.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "X-Accel-Buffering": "no",
    },
  });
}
