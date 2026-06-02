import { Injectable } from "@nestjs/common";
import { cancelJob } from "@/server/jobs/job-service";

@Injectable()
export class CancelJobUseCase {
  execute(id: string) {
    return cancelJob(id);
  }
}
