import { Injectable, OnModuleInit } from "@nestjs/common";
import { startJobRunner } from "@/server/jobs/job-runner";

@Injectable()
export class StartJobRunnerUseCase implements OnModuleInit {
  onModuleInit() {
    this.execute();
  }

  execute() {
    startJobRunner();
  }
}
