import { Module } from "@nestjs/common";
import { OauthController } from "./api/oauth.controller";
import { OauthUseCases } from "./use-cases/oauth.use-cases";

@Module({
  controllers: [OauthController],
  providers: [OauthUseCases],
})
export class OauthModule {}
