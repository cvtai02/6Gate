import { Injectable } from "@nestjs/common";
import { getProviderOrThrow } from "../shared/provider-helpers";

@Injectable()
export class GetProviderUseCase {
  execute(id: string) {
    return getProviderOrThrow(id);
  }
}
