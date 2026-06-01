import { Module } from "@nestjs/common";
import { DestinationsController } from "./api/destinations.controller";
import { DestinationsUseCases } from "./use-cases/destinations.use-cases";

@Module({ controllers: [DestinationsController], providers: [DestinationsUseCases] })
export class DestinationsModule {}

