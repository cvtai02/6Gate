import { Module } from "@nestjs/common";
import { UploadsController } from "./api/uploads.controller";
import { UploadsUseCases } from "./use-cases/uploads.use-cases";

@Module({
  controllers: [UploadsController],
  providers: [UploadsUseCases],
})
export class UploadsModule {}
