import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import { AddTelegramAccountUseCase } from "../usecases/commands/add-telegram-account.usecase";
import { AddTelegramChatUseCase } from "../usecases/commands/add-telegram-chat.usecase";
import { AddZernioAccountUseCase } from "../usecases/commands/add-zernio-account.usecase";
import { DeleteAccountUseCase } from "../usecases/commands/delete-account.usecase";
import { MetaManualConnectUseCase } from "../usecases/commands/meta-manual-connect.usecase";
import { MetaSyncUseCase } from "../usecases/commands/meta-sync.usecase";
import { RenameAccountUseCase } from "../usecases/commands/rename-account.usecase";
import { SyncAccountDestinationsUseCase } from "../usecases/commands/sync-account-destinations.usecase";
import { SyncZernioUseCase } from "../usecases/commands/sync-zernio.usecase";
import { ListAccountsUseCase } from "../usecases/queries/list-accounts.usecase";
import type { AddTelegramAccountDto } from "../dtos/add-telegram-account.dto";
import type { AddTelegramChatDto } from "../dtos/add-telegram-chat.dto";
import type { AddZernioAccountDto } from "../dtos/add-zernio-account.dto";
import type { MetaManualConnectDto } from "../dtos/meta-manual-connect.dto";
import type { MetaSyncDto } from "../dtos/meta-sync.dto";
import type { RenameAccountDto } from "../dtos/rename-account.dto";
import type { SyncZernioDto } from "../dtos/sync-zernio.dto";

@Controller("accounts")
export class AccountsController {
  constructor(
    private readonly listAccounts: ListAccountsUseCase,
    private readonly renameAccount: RenameAccountUseCase,
    private readonly deleteAccount: DeleteAccountUseCase,
    private readonly addZernioAccount: AddZernioAccountUseCase,
    private readonly addTelegramAccount: AddTelegramAccountUseCase,
    private readonly addTelegramChatUseCase: AddTelegramChatUseCase,
    private readonly syncZernioUseCase: SyncZernioUseCase,
    private readonly syncAccountDestinations: SyncAccountDestinationsUseCase,
    private readonly metaManualConnectUseCase: MetaManualConnectUseCase,
    private readonly metaSyncUseCase: MetaSyncUseCase,
  ) {}

  @Get()
  list(@Query("type") type?: string, @Query("providerId") providerId?: string) {
    return this.listAccounts.execute({ type, providerId });
  }

  @Patch(":id")
  rename(@Param("id") id: string, @Body() body: RenameAccountDto) {
    if (!body.displayName?.trim()) throw new Error("displayName is required");
    return this.renameAccount.execute(id, body.displayName.trim());
  }

  @Delete(":id")
  @HttpCode(204)
  async delete(@Param("id") id: string) {
    await this.deleteAccount.execute(id);
  }

  @Post("zernio/add")
  addZernio(@Body() body: AddZernioAccountDto) {
    return this.addZernioAccount.execute(body);
  }

  @Post("telegram/add")
  addTelegram(@Body() body: AddTelegramAccountDto) {
    return this.addTelegramAccount.execute(body);
  }

  @Post(":id/telegram/chats")
  addTelegramChat(@Param("id") id: string, @Body() body: AddTelegramChatDto) {
    return this.addTelegramChatUseCase.execute(id, body);
  }

  @Post("zernio/sync")
  syncZernio(@Body() body: SyncZernioDto) {
    return this.syncZernioUseCase.execute(body);
  }

  @Post(":id/sync-destinations")
  async syncDestinations(@Param("id") id: string) {
    return this.syncAccountDestinations.execute(id);
  }

  @Post(":id/sync")
  async syncBasic(@Param("id") id: string) {
    return this.syncDestinations(id);
  }

  @Post("meta/manual-connect")
  async metaManualConnect(@Body() body: MetaManualConnectDto) {
    return this.metaManualConnectUseCase.execute(body);
  }

  @Post("meta/sync")
  async metaSync(@Body() body: MetaSyncDto) {
    return this.metaSyncUseCase.execute(body);
  }
}
