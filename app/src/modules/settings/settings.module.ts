import { Module } from "@nestjs/common";
import { SettingsController } from "./api/settings.controller";
import { BootstrapSettingsDefaultsUseCase } from "./usecases/commands/bootstrap-settings-defaults.usecase";
import { UpdateSettingUseCase } from "./usecases/commands/update-setting.usecase";
import { ListSettingsUseCase } from "./usecases/queries/list-settings.usecase";

@Module({
  controllers: [SettingsController],
  providers: [BootstrapSettingsDefaultsUseCase, ListSettingsUseCase, UpdateSettingUseCase],
  exports: [BootstrapSettingsDefaultsUseCase, ListSettingsUseCase, UpdateSettingUseCase],
})
export class SettingsModule {}
