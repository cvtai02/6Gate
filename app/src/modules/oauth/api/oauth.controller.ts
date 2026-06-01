import { Body, Controller, Get, Post, Query, Redirect, Res } from "@nestjs/common";
import type { Response } from "express";
import { OauthUseCases } from "../use-cases/oauth.use-cases";

@Controller("accounts/oauth")
export class OauthController {
  constructor(private readonly oauth: OauthUseCases) {}

  @Post("start")
  async start(@Body() body: { providerId?: string }, @Res({ passthrough: true }) res: Response) {
    if (!body.providerId) {
      res.status(400);
      return { error: "providerId is required" };
    }

    try {
      const url = await this.oauth.start(body.providerId);
      return { url };
    } catch (err) {
      res.status(400);
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }

  @Get("callback")
  @Redirect()
  async callback(
    @Query("code") code?: string,
    @Query("state") state?: string,
    @Query("provider_id") providerIdParam?: string,
  ) {
    const rawState = state ?? "";
    const dot = rawState.indexOf(".");
    const decodedProviderId = dot !== -1 ? rawState.slice(0, dot) : rawState;
    const providerId = providerIdParam || decodedProviderId;

    if (!code || !providerId) {
      return { url: "/providers?error=Missing%20code%20or%20provider_id", statusCode: 302 };
    }

    const url = await this.oauth.callback({ providerId, code, state });
    return { url, statusCode: 302 };
  }
}
