import { Injectable } from "@nestjs/common";
import { deleteJob } from "@/server/jobs/job-service";

@Injectable()
export class DeleteJobUseCase {
  execute(id: string) {
    return deleteJob(id);
  }
}
