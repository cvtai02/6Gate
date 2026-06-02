import { Module } from "@nestjs/common";
import { ProvidersController } from "./api/providers.controller";
import { CreateProviderUseCase } from "./usecases/commands/create-provider.usecase";
import { DeleteProviderUseCase } from "./usecases/commands/delete-provider.usecase";
import { UpdateProviderUseCase } from "./usecases/commands/update-provider.usecase";
import { GetProviderUseCase } from "./usecases/queries/get-provider.usecase";
import { ListProvidersUseCase } from "./usecases/queries/list-providers.usecase";

@Module({
  controllers: [ProvidersController],
  providers: [CreateProviderUseCase, DeleteProviderUseCase, UpdateProviderUseCase, GetProviderUseCase, ListProvidersUseCase],
})
export class ProvidersModule {}
