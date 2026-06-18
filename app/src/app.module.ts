import { Module } from "@nestjs/common";
import { AuthModule } from "./modules/auth/auth.module";
import { HealthModule } from "./modules/health/health.module";
import { ProvidersModule } from "./modules/providers/providers.module";
import { AccountsModule } from "./modules/accounts/accounts.module";
import { DestinationsModule } from "./modules/destinations/destinations.module";
import { GroupsModule } from "./modules/groups/groups.module";
import { JobsModule } from "./modules/jobs/jobs.module";
import { OauthModule } from "./modules/oauth/oauth.module";
@Module({
  imports: [
    AuthModule,
    HealthModule,
    ProvidersModule,
    AccountsModule,
    DestinationsModule,
    GroupsModule,
    JobsModule,
    OauthModule,
  ],
})
export class AppModule {}
