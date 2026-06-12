import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { env } from "@/infrastructure/config/env";
import { verifySession } from "@/core/auth/jwt";

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();

    // Login-issued session token: Authorization: Bearer <jwt>
    const bearer = (req.headers["authorization"] as string | undefined)?.replace(/^bearer /i, "");
    if (bearer && verifySession(bearer, env.systemSecret)) return true;

    throw new UnauthorizedException();
  }
}
