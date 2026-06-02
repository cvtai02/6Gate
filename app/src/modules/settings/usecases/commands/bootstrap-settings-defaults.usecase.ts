import { Injectable, OnModuleInit } from "@nestjs/common";
import { DEFAULT_SETTINGS, readSettings, writeSettings } from "../shared/settings-store";

@Injectable()
export class BootstrapSettingsDefaultsUseCase implements OnModuleInit {
  async onModuleInit() {
    await this.execute();
  }

  async execute() {
    const settings = await readSettings();
    const now = new Date().toISOString();
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      settings[key] ??= { key, value, updatedAt: now };
    }
    await writeSettings(settings);
  }
}
