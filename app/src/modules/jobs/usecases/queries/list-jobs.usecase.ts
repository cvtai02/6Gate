import { Injectable } from "@nestjs/common";
import { listJobs } from "@/infrastructure/jobs/job-service";

@Injectable()
export class ListJobsUseCase {
  execute() {
    return listJobs();
  }
}
