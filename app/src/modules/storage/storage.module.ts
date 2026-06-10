import { Module } from "@nestjs/common";
import { StorageController } from "./api/storage.controller";
import { ListStorageUseCase } from "./usecases/queries/list-storage.usecase";
import { UpdateStorageUseCase } from "./usecases/commands/update-storage.usecase";
import { ProxyStorageRequestUseCase } from "./usecases/commands/proxy-storage-request.usecase";

@Module({
  controllers: [StorageController],
  providers: [ListStorageUseCase, UpdateStorageUseCase, ProxyStorageRequestUseCase],
  exports: [ListStorageUseCase],
})
export class StorageModule {}
