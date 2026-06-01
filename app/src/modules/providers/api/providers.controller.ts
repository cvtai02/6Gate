import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from "@nestjs/common";
import { ProvidersUseCases } from "../use-cases/providers.use-cases";

@Controller("providers")
export class ProvidersController {
  constructor(private readonly providers: ProvidersUseCases) {}

  @Get()
  list() {
    return this.providers.list();
  }

  @Post()
  create(@Body() body: any) {
    return this.providers.create(body);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.providers.get(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.providers.update(id, body);
  }

  @Delete(":id")
  @HttpCode(204)
  async delete(@Param("id") id: string) {
    await this.providers.delete(id);
  }
}

