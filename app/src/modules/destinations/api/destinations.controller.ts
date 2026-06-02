import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import { CreateDestinationUseCase } from "../usecases/commands/create-destination.usecase";
import { DeleteDestinationUseCase } from "../usecases/commands/delete-destination.usecase";
import { ListDestinationsUseCase } from "../usecases/queries/list-destinations.usecase";
import type { CreateDestinationDto } from "../dtos/create-destination.dto";

@Controller("publish-destinations")
export class DestinationsController {
  constructor(
    private readonly listDestinations: ListDestinationsUseCase,
    private readonly createDestination: CreateDestinationUseCase,
    private readonly deleteDestination: DeleteDestinationUseCase,
  ) {}

  @Get()
  list(@Query("type") type?: string, @Query("providerId") providerId?: string) {
    return this.listDestinations.execute({ type, providerId });
  }

  @Post()
  create(@Body() body: CreateDestinationDto) {
    return this.createDestination.execute(body);
  }

  @Delete(":id")
  @HttpCode(204)
  async delete(@Param("id") id: string) {
    await this.deleteDestination.execute(id);
  }
}
