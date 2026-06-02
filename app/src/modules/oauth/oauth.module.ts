import { Module } from "@nestjs/common";
import { OauthController } from "./api/oauth.controller";
import { HandleOauthCallbackUseCase } from "./usecases/commands/handle-oauth-callback.usecase";
import { StartOauthUseCase } from "./usecases/commands/start-oauth.usecase";

@Module({
  controllers: [OauthController],
  providers: [HandleOauthCallbackUseCase, StartOauthUseCase],
})
export class OauthModule {}
