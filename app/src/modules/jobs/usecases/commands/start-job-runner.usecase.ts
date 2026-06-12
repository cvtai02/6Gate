import { Injectable, OnModuleInit } from "@nestjs/common";
import { startJobRunner } from "@/infrastructure/jobs/job-runner";

@Injectable()
export class StartJobRunnerUseCase implements OnModuleInit {
  onModuleInit() {
    this.execute();
  }

  execute() {
    startJobRunner();
  }
}
