import { Body, Controller, Get, HttpCode, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { env } from "@/server/config/env";
import { signSession, verifySession } from "@/lib/jwt";

const COOKIE_OPTS = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 86400 * 30 };

@Controller("auth")
export class AuthController {
  @Post("login")
  @HttpCode(200)
  login(@Body() body: { secret?: string }, @Res({ passthrough: true }) res: Response) {
    if (!body.secret || body.secret !== env.systemSecret) {
      res.status(401);
      return { ok: false, error: "Invalid system secret" };
    }
    res.cookie("session", signSession(env.systemSecret), COOKIE_OPTS);
    return { ok: true };
  }

  @Post("logout")
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie("session", { path: "/" });
    return { ok: true };
  }

  @Get("me")
  me(@Req() req: Request) {
    const bearer = (req.headers["authorization"] as string | undefined)?.replace(/^bearer /i, "");
    if (bearer && verifySession(bearer, env.systemSecret)) return { ok: true };
    return { ok: false };
  }
}
