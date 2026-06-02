import { Module } from "@nestjs/common";
import { DestinationsController } from "./api/destinations.controller";
import { CreateDestinationUseCase } from "./usecases/commands/create-destination.usecase";
import { DeleteDestinationUseCase } from "./usecases/commands/delete-destination.usecase";
import { ListDestinationsUseCase } from "./usecases/queries/list-destinations.usecase";

@Module({
  controllers: [DestinationsController],
  providers: [CreateDestinationUseCase, DeleteDestinationUseCase, ListDestinationsUseCase],
})
export class DestinationsModule {}
