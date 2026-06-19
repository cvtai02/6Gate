import { Body, Controller, Delete, Get, Param, Post, HttpCode } from "@nestjs/common";
import { HandleTelegramWebhookUseCase } from "../usecases/handle-telegram-webhook.usecase";
import { addWebhookLog, getWebhookLogs, clearWebhookLogs } from "../webhook-log";

@Controller("webhooks/telegram")
export class TelegramWebhookController {
  constructor(private readonly handleWebhook: HandleTelegramWebhookUseCase) {}

  @Get("logs")
  getLogs() {
    return getWebhookLogs();
  }

  @Delete("logs")
  @HttpCode(204)
  deleteLogs() {
    clearWebhookLogs();
  }

  @Post(":accountId")
  @HttpCode(200)
  async receive(@Param("accountId") accountId: string, @Body() body: unknown) {
    let result = "ok";
    try {
      await this.handleWebhook.execute(accountId, body as any);
    } catch (err) {
      result = err instanceof Error ? err.message : String(err);
    }
    addWebhookLog(accountId, body, result);
    return { ok: true };
  }
}
