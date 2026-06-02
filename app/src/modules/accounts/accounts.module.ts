import { Module } from "@nestjs/common";
import { AccountsController } from "./api/accounts.controller";
import { AddTelegramAccountUseCase } from "./usecases/commands/add-telegram-account.usecase";
import { AddTelegramChatUseCase } from "./usecases/commands/add-telegram-chat.usecase";
import { AddZernioAccountUseCase } from "./usecases/commands/add-zernio-account.usecase";
import { DeleteAccountUseCase } from "./usecases/commands/delete-account.usecase";
import { MetaManualConnectUseCase } from "./usecases/commands/meta-manual-connect.usecase";
import { MetaSyncUseCase } from "./usecases/commands/meta-sync.usecase";
import { RenameAccountUseCase } from "./usecases/commands/rename-account.usecase";
import { SyncAccountDestinationsUseCase } from "./usecases/commands/sync-account-destinations.usecase";
import { SyncTelegramChatsUseCase } from "./usecases/commands/sync-telegram-chats.usecase";
import { SyncZernioUseCase } from "./usecases/commands/sync-zernio.usecase";
import { ListAccountsUseCase } from "./usecases/queries/list-accounts.usecase";

@Module({
  controllers: [AccountsController],
  providers: [
    AddTelegramAccountUseCase,
    AddTelegramChatUseCase,
    AddZernioAccountUseCase,
    DeleteAccountUseCase,
    MetaManualConnectUseCase,
    MetaSyncUseCase,
    RenameAccountUseCase,
    SyncAccountDestinationsUseCase,
    SyncTelegramChatsUseCase,
    SyncZernioUseCase,
    ListAccountsUseCase,
  ],
})
export class AccountsModule {}
