import { Injectable } from "@nestjs/common";
import { getJob } from "@/infrastructure/jobs/job-service";

@Injectable()
export class GetJobUseCase {
  execute(id: string) {
    return getJob(id);
  }
}
