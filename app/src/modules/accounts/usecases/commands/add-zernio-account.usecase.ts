import { Injectable } from "@nestjs/common";
import { createZernioAccount } from "@/infrastructure/providers/zernio-service";
import type { AddZernioAccountDto } from "../../dtos/add-zernio-account.dto";

@Injectable()
export class AddZernioAccountUseCase {
  execute(input: AddZernioAccountDto) {
    return createZernioAccount(input.providerId, input.name?.trim() || "Zernio Account", input.apiKey);
  }
}
