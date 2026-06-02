import { Module } from "@nestjs/common";
import { JobsController } from "./api/jobs.controller";
import { CancelJobUseCase } from "./usecases/commands/cancel-job.usecase";
import { CreateJobUseCase } from "./usecases/commands/create-job.usecase";
import { DeleteJobUseCase } from "./usecases/commands/delete-job.usecase";
import { RetryJobUseCase } from "./usecases/commands/retry-job.usecase";
import { StartJobRunnerUseCase } from "./usecases/commands/start-job-runner.usecase";
import { GetJobDetailUseCase } from "./usecases/queries/get-job-detail.usecase";
import { GetJobLogsUseCase } from "./usecases/queries/get-job-logs.usecase";
import { GetJobUseCase } from "./usecases/queries/get-job.usecase";
import { ListJobsTableUseCase } from "./usecases/queries/list-jobs-table.usecase";
import { ListJobsUseCase } from "./usecases/queries/list-jobs.usecase";

@Module({
  controllers: [JobsController],
  providers: [
    CancelJobUseCase,
    CreateJobUseCase,
    DeleteJobUseCase,
    RetryJobUseCase,
    StartJobRunnerUseCase,
    GetJobDetailUseCase,
    GetJobLogsUseCase,
    GetJobUseCase,
    ListJobsTableUseCase,
    ListJobsUseCase,
  ],
})
export class JobsModule {}
