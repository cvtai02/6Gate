import { Body, Controller, Get, HttpException, HttpStatus, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@/core/guards/system-token.guard";
import { ListStorageUseCase } from "../usecases/queries/list-storage.usecase";
import { UpdateStorageUseCase } from "../usecases/commands/update-storage.usecase";
import { ProxyStorageRequestUseCase } from "../usecases/commands/proxy-storage-request.usecase";
import type { UpdateStorageDto } from "../dtos/update-storage.dto";

@Controller("7router")
export class StorageController {
  constructor(
    private readonly listStorage: ListStorageUseCase,
    private readonly updateStorage: UpdateStorageUseCase,
    private readonly proxy: ProxyStorageRequestUseCase,
  ) {}

  @Get()
  @UseGuards(AuthGuard)
  list() {
    return this.listStorage.execute();
  }

  @Patch(":id")
  @UseGuards(AuthGuard)
  update(@Param("id") id: string, @Body() body: UpdateStorageDto) {
    return this.updateStorage.execute(id, { baseUrl: body.baseUrl, accessToken: body.accessToken });
  }

  @Get(":id/access/directories")
  @UseGuards(AuthGuard)
  async accessDirectories(@Param("id") id: string) {
    try {
      return await this.proxy.get(id, "/access/directories");
    } catch (err) {
      throw new HttpException((err as Error).message, HttpStatus.BAD_GATEWAY);
    }
  }

  @Post(":id/files/list")
  @UseGuards(AuthGuard)
  async filesList(@Param("id") id: string, @Body() body: { path: string }) {
    try {
      return await this.proxy.post(id, "/files/list", body);
    } catch (err) {
      throw new HttpException((err as Error).message, HttpStatus.BAD_GATEWAY);
    }
  }

  @Post(":id/files/all")
  @UseGuards(AuthGuard)
  async filesAll(@Param("id") id: string, @Body() body: { path: string }) {
    try {
      return await this.proxy.post(id, "/files/all", body);
    } catch (err) {
      throw new HttpException((err as Error).message, HttpStatus.BAD_GATEWAY);
    }
  }

  @Post(":id/files/get")
  @UseGuards(AuthGuard)
  async filesGet(@Param("id") id: string, @Body() body: { absolutePath: string }) {
    try {
      return await this.proxy.post(id, "/files/get", body);
    } catch (err) {
      throw new HttpException((err as Error).message, HttpStatus.BAD_GATEWAY);
    }
  }
}
