import { Body, Controller, Get, Param, Patch } from "@nestjs/common";
import { SettingsUseCases } from "../use-cases/settings.use-cases";

@Controller("settings")
export class SettingsController {
  constructor(private readonly settings: SettingsUseCases) {}

  @Get()
  list() {
    return this.settings.list();
  }

  @Patch(":key")
  update(@Param("key") key: string, @Body() body: { value?: string }) {
    return this.settings.update(key, String(body.value ?? ""));
  }
}

