import { Module } from "@nestjs/common";
import { UploadsController } from "./api/uploads.controller";
import { SaveTempFileUseCase } from "./usecases/save-temp-file.usecase";

@Module({
  controllers: [UploadsController],
  providers: [SaveTempFileUseCase],
})
export class UploadsModule {}
