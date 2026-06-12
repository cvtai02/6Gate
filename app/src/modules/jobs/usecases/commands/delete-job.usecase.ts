import { Injectable } from "@nestjs/common";
import { deleteJob } from "@/infrastructure/jobs/job-service";

@Injectable()
export class DeleteJobUseCase {
  execute(id: string) {
    return deleteJob(id);
  }
}
