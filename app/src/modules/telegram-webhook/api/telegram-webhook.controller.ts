import { Body, Controller, Param, Post, HttpCode } from "@nestjs/common";
import { HandleTelegramWebhookUseCase } from "../usecases/handle-telegram-webhook.usecase";

@Controller("webhooks/telegram")
export class TelegramWebhookController {
  constructor(private readonly handleWebhook: HandleTelegramWebhookUseCase) {}

  @Post(":accountId")
  @HttpCode(200)
  async receive(@Param("accountId") accountId: string, @Body() body: unknown) {
    console.log("[Webhook] Received update for account", accountId, JSON.stringify(body).slice(0, 500));
    try {
      await this.handleWebhook.execute(accountId, body as any);
    } catch (err) {
      console.error("[Webhook] Error:", err);
    }
    return { ok: true };
  }
}
