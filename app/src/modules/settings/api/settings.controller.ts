import { Body, Controller, Get, Param, Patch } from "@nestjs/common";
import { UpdateSettingUseCase } from "../usecases/commands/update-setting.usecase";
import { ListSettingsUseCase } from "../usecases/queries/list-settings.usecase";
import type { UpdateSettingDto } from "../dtos/update-setting.dto";

@Controller("settings")
export class SettingsController {
  constructor(
    private readonly listSettings: ListSettingsUseCase,
    private readonly updateSetting: UpdateSettingUseCase,
  ) {}

  @Get()
  list() {
    return this.listSettings.execute();
  }

  @Patch(":key")
  update(@Param("key") key: string, @Body() body: UpdateSettingDto) {
    return this.updateSetting.execute(key, String(body.value ?? ""));
  }
}
