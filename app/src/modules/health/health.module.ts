import { Module } from "@nestjs/common";
import { HealthController } from "./api/health.controller";
import { GetHealthStatusUseCase } from "./usecases/get-health-status.usecase";

@Module({ controllers: [HealthController], providers: [GetHealthStatusUseCase] })
export class HealthModule {}
