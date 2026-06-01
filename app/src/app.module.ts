import { Module } from "@nestjs/common";
import { HealthModule } from "./modules/health/health.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { ProvidersModule } from "./modules/providers/providers.module";
import { AccountsModule } from "./modules/accounts/accounts.module";
import { DestinationsModule } from "./modules/destinations/destinations.module";
import { GroupsModule } from "./modules/groups/groups.module";
import { JobsModule } from "./modules/jobs/jobs.module";
import { OauthModule } from "./modules/oauth/oauth.module";
import { UploadsModule } from "./modules/uploads/uploads.module";

@Module({
  imports: [
    HealthModule,
    SettingsModule,
    ProvidersModule,
    AccountsModule,
    DestinationsModule,
    GroupsModule,
    JobsModule,
    OauthModule,
    UploadsModule,
  ],
})
export class AppModule {}

