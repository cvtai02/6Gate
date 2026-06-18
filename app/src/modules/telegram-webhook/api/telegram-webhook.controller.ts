import { Body, Controller, Param, Post, HttpCode } from "@nestjs/common";
import { HandleTelegramWebhookUseCase } from "../usecases/handle-telegram-webhook.usecase";

@Controller("webhooks/telegram")
export class TelegramWebhookController {
  constructor(private readonly handleWebhook: HandleTelegramWebhookUseCase) {}

  @Post(":accountId")
  @HttpCode(200)
  async receive(@Param("accountId") accountId: string, @Body() body: unknown) {
    await this.handleWebhook.execute(accountId, body as any).catch(() => undefined);
    return { ok: true };
  }
}
