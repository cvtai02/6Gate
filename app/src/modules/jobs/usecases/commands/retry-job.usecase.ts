import { Injectable } from "@nestjs/common";
import { requeueJob } from "@/infrastructure/jobs/job-service";
import { StartJobRunnerUseCase } from "./start-job-runner.usecase";

@Injectable()
export class RetryJobUseCase {
  constructor(private readonly startJobRunner: StartJobRunnerUseCase) {}

  execute(id: string) {
    this.startJobRunner.execute();
    return requeueJob(id);
  }
}
