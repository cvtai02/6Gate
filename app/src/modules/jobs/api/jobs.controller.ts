import { Body, Controller, Delete, Get, HttpCode, Param, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import { CancelJobUseCase } from "../usecases/commands/cancel-job.usecase";
import { CreateJobUseCase } from "../usecases/commands/create-job.usecase";
import { DeleteJobUseCase } from "../usecases/commands/delete-job.usecase";
import { RetryJobUseCase } from "../usecases/commands/retry-job.usecase";
import { GetJobDetailUseCase } from "../usecases/queries/get-job-detail.usecase";
import { GetJobLogsUseCase } from "../usecases/queries/get-job-logs.usecase";
import { GetJobUseCase } from "../usecases/queries/get-job.usecase";
import { ListJobsTableUseCase } from "../usecases/queries/list-jobs-table.usecase";
import { ListJobsUseCase } from "../usecases/queries/list-jobs.usecase";
import type { CreateJobDto } from "../dtos/create-job.dto";

const TERMINAL_STATUSES = ["Published", "Failed", "Cancelled"] as const;

@Controller("post-jobs")
export class JobsController {
  constructor(
    private readonly listJobs: ListJobsUseCase,
    private readonly listJobsTable: ListJobsTableUseCase,
    private readonly createJob: CreateJobUseCase,
    private readonly getJobDetail: GetJobDetailUseCase,
    private readonly getJob: GetJobUseCase,
    private readonly getJobLogs: GetJobLogsUseCase,
    private readonly deleteJob: DeleteJobUseCase,
    private readonly cancelJob: CancelJobUseCase,
    private readonly retryJob: RetryJobUseCase,
  ) {}

  @Get()
  list() {
    return this.listJobs.execute();
  }

  @Get("table")
  table() {
    return this.listJobsTable.execute();
  }

  @Post()
  create(@Body() body: CreateJobDto) {
    return this.createJob.execute(body);
  }

  @Get(":id")
  async get(@Param("id") id: string, @Res({ passthrough: true }) res: Response) {
    const job = await this.getJobDetail.execute(id);
    if (!job) {
      res.status(404);
      return { error: "Not found" };
    }
    return job;
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(@Param("id") id: string) {
    await this.deleteJob.execute(id);
  }

  @Post(":id/cancel")
  cancel(@Param("id") id: string) {
    return this.cancelJob.execute(id);
  }

  @Post(":id/retry")
  retry(@Param("id") id: string) {
    return this.retryJob.execute(id);
  }

  @Get(":id/events")
  async events(@Param("id") id: string, @Res() res: Response) {
    const job = await this.getJob.execute(id);
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

    for (const log of await this.getJobLogs.execute(id)) {
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
      const [logs, currentJob] = await Promise.all([this.getJobLogs.execute(id), this.getJob.execute(id)]);
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
