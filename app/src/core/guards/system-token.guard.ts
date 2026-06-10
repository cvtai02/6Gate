import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { env } from "@/server/config/env";
import { verifySession } from "@/lib/jwt";

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();

    // JWT session forwarded by the Next.js proxy (Authorization: Bearer <jwt>)
    const bearer = (req.headers["authorization"] as string | undefined)?.replace(/^bearer /i, "");
    if (bearer && verifySession(bearer, env.systemSecret)) return true;

    // Raw secret for direct API clients (x-system-secret: <secret>)
    const raw = req.headers["x-system-secret"] as string | undefined;
    if (raw === env.systemSecret) return true;

    throw new UnauthorizedException();
  }
}
