import { Module } from "@nestjs/common";
import { TelegramWebhookController } from "./api/telegram-webhook.controller";
import { HandleTelegramWebhookUseCase } from "./usecases/handle-telegram-webhook.usecase";
import { GroupsModule } from "../groups/groups.module";

@Module({
  imports: [GroupsModule],
  controllers: [TelegramWebhookController],
  providers: [HandleTelegramWebhookUseCase],
})
export class TelegramWebhookModule {}
