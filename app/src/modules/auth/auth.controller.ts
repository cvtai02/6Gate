import { Body, Controller, Get, HttpCode, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { env } from "@/server/config/env";
import { signSession, verifySession } from "@/lib/jwt";

@Controller("auth")
export class AuthController {
  @Post("login")
  @HttpCode(200)
  login(@Body() body: { secret?: string }, @Res({ passthrough: true }) res: Response) {
    if (!body.secret || body.secret !== env.systemSecret) {
      res.status(401);
      return { ok: false, error: "Invalid system secret" };
    }
    // Token-based auth: return the signed session token in the body. The UI stores
    // it in localStorage and sends it as `Authorization: Bearer <token>`.
    return { ok: true, token: signSession(env.systemSecret) };
  }

  @Post("logout")
  @HttpCode(200)
  logout() {
    // Stateless tokens: nothing to revoke server-side. The client drops the token.
    return { ok: true };
  }

  @Get("me")
  me(@Req() req: Request) {
    const bearer = (req.headers["authorization"] as string | undefined)?.replace(/^bearer /i, "");
    if (bearer && verifySession(bearer, env.systemSecret)) return { ok: true };
    return { ok: false };
  }
}
