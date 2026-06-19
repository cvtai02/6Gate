import { Body, Controller, Delete, Get, Param, Post, HttpCode } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db";
import { accounts, providers } from "@/infrastructure/db/schema";
import { telegramRequest } from "@/modules/accounts/usecases/shared/telegram-helpers";
import { decryptValue } from "@/core/security/crypto";
import { env } from "@/infrastructure/config/env";
import { ProviderType } from "@/core/enums";
import { HandleTelegramWebhookUseCase } from "../usecases/handle-telegram-webhook.usecase";
import { addWebhookLog, getWebhookLogs, clearWebhookLogs } from "../webhook-log";

@Controller("webhooks/telegram")
export class TelegramWebhookController {
  constructor(private readonly handleWebhook: HandleTelegramWebhookUseCase) {}

  @Get("logs")
  getLogs() {
    return getWebhookLogs();
  }

  @Get("status")
  async getStatus() {
    const db = getDb();
    const allAccounts = await db.select().from(accounts);
    const allProviders = await db.select().from(providers);
    const telegramProviderIds = new Set(
      allProviders.filter((p) => p.type === ProviderType.telegram).map((p) => p.id),
    );
    const botAccounts = allAccounts.filter((a) => telegramProviderIds.has(a.providerId) && a.accessToken);

    const results = [];
    for (const acct of botAccounts) {
      const botToken = decryptValue(acct.accessToken!, env.encryptionKey);
      try {
        const info = await telegramRequest<any>(botToken, "getWebhookInfo", {});
        results.push({
          accountId: acct.id,
          botName: acct.displayName ?? acct.username,
          webhookUrl: info.url || null,
          pendingUpdateCount: info.pending_update_count ?? 0,
          lastErrorDate: info.last_error_date ? new Date(info.last_error_date * 1000).toISOString() : null,
          lastErrorMessage: info.last_error_message ?? null,
          maxConnections: info.max_connections ?? null,
          allowedUpdates: info.allowed_updates ?? null,
        });
      } catch (err) {
        results.push({
          accountId: acct.id,
          botName: acct.displayName ?? acct.username,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return results;
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
