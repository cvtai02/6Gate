import { Module } from "@nestjs/common";
import { JobsController } from "./api/jobs.controller";
import { JobsUseCases } from "./use-cases/jobs.use-cases";

@Module({ controllers: [JobsController], providers: [JobsUseCases] })
export class JobsModule {}

