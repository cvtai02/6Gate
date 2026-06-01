import { Body, Controller, Delete, Get, HttpCode, Param, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import { JobsUseCases } from "../use-cases/jobs.use-cases";
import { getJobLogs } from "@/server/jobs/log-service";
import { getJob } from "@/server/jobs/job-service";

const TERMINAL_STATUSES = ["Published", "Failed", "Cancelled"] as const;

@Controller("post-jobs")
export class JobsController {
  constructor(private readonly jobs: JobsUseCases) {}

  @Get()
  list() {
    return this.jobs.listRaw();
  }

  @Get("table")
  table() {
    return this.jobs.listForTable();
  }

  @Post()
  create(@Body() body: unknown) {
    return this.jobs.create(body);
  }

  @Get(":id")
  async get(@Param("id") id: string, @Res({ passthrough: true }) res: Response) {
    const job = await this.jobs.get(id);
    if (!job) {
      res.status(404);
      return { error: "Not found" };
    }
    return job;
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(@Param("id") id: string) {
    await this.jobs.remove(id);
  }

  @Post(":id/cancel")
  cancel(@Param("id") id: string) {
    return this.jobs.cancel(id);
  }

  @Post(":id/retry")
  retry(@Param("id") id: string) {
    return this.jobs.retry(id);
  }

  @Get(":id/events")
  async events(@Param("id") id: string, @Res() res: Response) {
    const job = await getJob(id);
    if (!job) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    let closed = false;
    let lastStatus = job.status;
    const seenLogIds = new Set<string>();

    const send = (event: string, data: unknown) => {
      if (closed) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    const close = () => {
      if (closed) return;
      closed = true;
      clearInterval(poll);
      clearInterval(heartbeat);
      res.end();
    };

    for (const log of await getJobLogs(id)) {
      seenLogIds.add(log.id);
      send("log", { level: log.level, message: log.message, createdAt: log.createdAt });
    }
    send("status", {
      status: job.status,
      providerPostId: job.providerPostId,
      providerPostUrl: job.providerPostUrl,
      errorMessage: job.errorMessage,
    });

    const poll = setInterval(async () => {
      const [logs, currentJob] = await Promise.all([getJobLogs(id), getJob(id)]);
      for (const log of logs) {
        if (!seenLogIds.has(log.id)) {
          seenLogIds.add(log.id);
          send("log", { level: log.level, message: log.message, createdAt: log.createdAt });
        }
      }
      if (!currentJob) {
        send("status", { status: "Deleted" });
        close();
        return;
      }
      if (currentJob.status !== lastStatus) {
        lastStatus = currentJob.status;
        send("status", {
          status: currentJob.status,
          providerPostId: currentJob.providerPostId,
          providerPostUrl: currentJob.providerPostUrl,
          errorMessage: currentJob.errorMessage,
        });
      }
      if ((TERMINAL_STATUSES as readonly string[]).includes(currentJob.status)) close();
    }, 1000);

    const heartbeat = setInterval(() => {
      if (!closed) res.write(`: ping\n\n`);
    }, 25000);

    res.on("close", close);
  }
}

