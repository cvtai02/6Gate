import { Injectable } from "@nestjs/common";
import { RuntimeSettingDto } from "@sixgate/api-client";
import { readSettings, writeSettings } from "../shared/settings-store";

@Injectable()
export class UpdateSettingUseCase {
  async execute(key: string, value: string): Promise<RuntimeSettingDto> {
    const settings = await readSettings();
    const now = new Date().toISOString();
    settings[key] = { key, value, updatedAt: now };
    await writeSettings(settings);
    return settings[key];
  }
}
