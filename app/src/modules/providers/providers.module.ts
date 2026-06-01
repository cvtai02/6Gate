import { Module } from "@nestjs/common";
import { ProvidersController } from "./api/providers.controller";
import { ProvidersUseCases } from "./use-cases/providers.use-cases";

@Module({ controllers: [ProvidersController], providers: [ProvidersUseCases] })
export class ProvidersModule {}

