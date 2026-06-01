import { Module } from "@nestjs/common";
import { SettingsController } from "./api/settings.controller";
import { SettingsUseCases } from "./use-cases/settings.use-cases";

@Module({
  controllers: [SettingsController],
  providers: [SettingsUseCases],
  exports: [SettingsUseCases],
})
export class SettingsModule {}

