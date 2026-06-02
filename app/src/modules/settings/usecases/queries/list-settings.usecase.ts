import { Injectable } from "@nestjs/common";
import { RuntimeSettingDto } from "@sixgate/api-client";
import { BootstrapSettingsDefaultsUseCase } from "../commands/bootstrap-settings-defaults.usecase";
import { readSettings } from "../shared/settings-store";

@Injectable()
export class ListSettingsUseCase {
  constructor(private readonly bootstrapDefaults: BootstrapSettingsDefaultsUseCase) {}

  async execute(): Promise<RuntimeSettingDto[]> {
    await this.bootstrapDefaults.execute();
    return Object.values(await readSettings()).sort((a, b) => a.key.localeCompare(b.key));
  }
}
