import { Injectable } from "@nestjs/common";
import { syncZernioAccount, syncZernioAccounts } from "@/server/providers/zernio-service";
import type { SyncZernioDto } from "../../dtos/sync-zernio.dto";

@Injectable()
export class SyncZernioUseCase {
  execute(input: SyncZernioDto) {
    if (input.accountId) return syncZernioAccount(input.accountId);
    if (!input.providerId) throw new Error("providerId is required");
    return syncZernioAccounts(input.providerId);
  }
}
