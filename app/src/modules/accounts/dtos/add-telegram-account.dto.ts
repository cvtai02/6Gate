export interface AddTelegramAccountDto {
  providerId?: string;
  name?: string;
  botToken: string;
  chatId?: string;
  chatName?: string;
}
