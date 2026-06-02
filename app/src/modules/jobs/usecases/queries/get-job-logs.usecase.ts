import { Injectable } from "@nestjs/common";
import { getJobLogs } from "@/server/jobs/log-service";

@Injectable()
export class GetJobLogsUseCase {
  execute(id: string) {
    return getJobLogs(id);
  }
}
