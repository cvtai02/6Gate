import { Injectable } from "@nestjs/common";
import type { AddTelegramChatDto } from "../../dtos/add-telegram-chat.dto";
import { getTelegramAccountOrThrow, telegramRequest, TelegramChatInfo, upsertTelegramChatDestination } from "../shared/telegram-helpers";

@Injectable()
export class AddTelegramChatUseCase {
  async execute(accountId: string, input: AddTelegramChatDto) {
    const chatId = input.chatId?.trim();
    if (!chatId) throw new Error("chatId is required");

    const account = await getTelegramAccountOrThrow(accountId);
    const chat = await telegramRequest<TelegramChatInfo>(account.accessToken!, "getChat", { chat_id: chatId });
    return upsertTelegramChatDestination(accountId, chat, input.chatName);
  }
}
