import { Injectable } from "@nestjs/common";
import { startOAuth } from "@/infrastructure/auth/oauth-service";

@Injectable()
export class StartOauthUseCase {
  execute(providerId: string) {
    return startOAuth(providerId);
  }
}
