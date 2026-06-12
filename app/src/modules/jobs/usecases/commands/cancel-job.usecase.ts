import { Injectable } from "@nestjs/common";
import { cancelJob } from "@/infrastructure/jobs/job-service";

@Injectable()
export class CancelJobUseCase {
  execute(id: string) {
    return cancelJob(id);
  }
}
