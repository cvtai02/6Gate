import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from "@nestjs/common";
import { CreateProviderUseCase } from "../usecases/commands/create-provider.usecase";
import { DeleteProviderUseCase } from "../usecases/commands/delete-provider.usecase";
import { UpdateProviderUseCase } from "../usecases/commands/update-provider.usecase";
import { GetProviderUseCase } from "../usecases/queries/get-provider.usecase";
import { ListProvidersUseCase } from "../usecases/queries/list-providers.usecase";
import type { CreateProviderDto } from "../dtos/create-provider.dto";
import type { UpdateProviderDto } from "../dtos/update-provider.dto";

@Controller("providers")
export class ProvidersController {
  constructor(
    private readonly listProviders: ListProvidersUseCase,
    private readonly createProvider: CreateProviderUseCase,
    private readonly getProvider: GetProviderUseCase,
    private readonly updateProvider: UpdateProviderUseCase,
    private readonly deleteProvider: DeleteProviderUseCase,
  ) {}

  @Get()
  list() {
    return this.listProviders.execute();
  }

  @Post()
  create(@Body() body: CreateProviderDto) {
    return this.createProvider.execute(body);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.getProvider.execute(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: UpdateProviderDto) {
    return this.updateProvider.execute(id, body);
  }

  @Delete(":id")
  @HttpCode(204)
  async delete(@Param("id") id: string) {
    await this.deleteProvider.execute(id);
  }
}
