import { Injectable } from "@nestjs/common";
import { listJobs } from "@/server/jobs/job-service";

@Injectable()
export class ListJobsUseCase {
  execute() {
    return listJobs();
  }
}
