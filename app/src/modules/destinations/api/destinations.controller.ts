import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import { DestinationsUseCases } from "../use-cases/destinations.use-cases";

@Controller("publish-destinations")
export class DestinationsController {
  constructor(private readonly destinations: DestinationsUseCases) {}

  @Get()
  list(@Query("type") type?: string, @Query("providerId") providerId?: string) {
    return this.destinations.list({ type, providerId });
  }

  @Post()
  create(@Body() body: { socialAccountId: string; name: string; type: string; externalId?: string | null }) {
    return this.destinations.create(body);
  }

  @Delete(":id")
  @HttpCode(204)
  async delete(@Param("id") id: string) {
    await this.destinations.delete(id);
  }
}

