import { Injectable } from "@nestjs/common";
import type { HealthStatusDto } from "../dtos/health-status.dto";

@Injectable()
export class GetHealthStatusUseCase {
  execute(): HealthStatusDto {
    return { ok: true };
  }
}
