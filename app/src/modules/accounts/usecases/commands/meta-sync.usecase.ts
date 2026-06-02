import { Injectable } from "@nestjs/common";
import type { MetaSyncDto } from "../../dtos/meta-sync.dto";
import { ListAccountsUseCase } from "../queries/list-accounts.usecase";

@Injectable()
export class MetaSyncUseCase {
  constructor(private readonly listAccounts: ListAccountsUseCase) {}

  async execute(input: MetaSyncDto) {
    const rows = await this.listAccounts.execute({ providerId: input.providerId });
    return { created: 0, updated: rows.length, deleted: 0 };
  }
}
