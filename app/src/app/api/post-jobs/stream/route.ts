import { subscribeToAllJobs } from "@/server/jobs/log-service";
import { listJobs } from "@/server/jobs/job-service";
import { startJobRunner } from "@/server/jobs/job-runner";

export const dynamic = "force-dynamic";

startJobRunner();

export async function GET(req: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const safeEnqueue = (chunk: Uint8Array) => {
        if (closed) return;
        try {
          controller.enqueue(chunk);
        } catch {
          closed = true;
        }
      };

      // Initial snapshot so a fresh client knows current state without an extra fetch.
      const jobs = await listJobs();
      const snapshot = `event: snapshot\ndata: ${JSON.stringify(jobs)}\n\n`;
      safeEnqueue(encoder.encode(snapshot));

      const unsubscribe = subscribeToAllJobs((event) => {
        safeEnqueue(encoder.encode(event));
      });

      // Heartbeat every 25s to keep proxies from idling the connection out.
      const heartbeat = setInterval(() => {
        safeEnqueue(encoder.encode(`: ping\n\n`));
      }, 25000);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      req.signal.addEventListener("abort", cleanup);
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
