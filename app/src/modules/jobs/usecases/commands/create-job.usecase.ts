import { Injectable } from "@nestjs/common";
import { createJob } from "@/server/jobs/job-service";
import type { CreateJobDto } from "../../dtos/create-job.dto";

@Injectable()
export class CreateJobUseCase {
  execute(input: CreateJobDto) {
    return createJob(input as any);
  }
}
