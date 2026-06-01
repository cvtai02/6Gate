import { Module } from "@nestjs/common";
import { AccountsController } from "./api/accounts.controller";
import { AccountsUseCases } from "./use-cases/accounts.use-cases";

@Module({ controllers: [AccountsController], providers: [AccountsUseCases] })
export class AccountsModule {}

