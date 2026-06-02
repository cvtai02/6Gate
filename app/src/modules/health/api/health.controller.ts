import { Controller, Get } from "@nestjs/common";
import { GetHealthStatusUseCase } from "../usecases/get-health-status.usecase";

@Controller("health")
export class HealthController {
  constructor(private readonly getHealthStatus: GetHealthStatusUseCase) {}

  @Get()
  get() {
    return this.getHealthStatus.execute();
  }
}
