import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { AddGroupDestinationUseCase } from "../usecases/commands/add-group-destination.usecase";
import { CreateGroupUseCase } from "../usecases/commands/create-group.usecase";
import { CreateGroupUploadJobsUseCase } from "../usecases/commands/create-group-upload-jobs.usecase";
import { EnqueueGroupUploadUseCase } from "../usecases/commands/enqueue-group-upload.usecase";
import { RemoveGroupUseCase } from "../usecases/commands/remove-group.usecase";
import { RemoveGroupDestinationUseCase } from "../usecases/commands/remove-group-destination.usecase";
import { RemoveGroupQueueItemUseCase } from "../usecases/commands/remove-group-queue-item.usecase";
import { RenameGroupUseCase } from "../usecases/commands/rename-group.usecase";
import { UpdateGroupUploadSettingsUseCase } from "../usecases/commands/update-group-upload-settings.usecase";
import { GetGroupHistoryUseCase } from "../usecases/queries/get-group-history.usecase";
import { GetGroupUploadSettingsUseCase } from "../usecases/queries/get-group-upload-settings.usecase";
import { GetNextUploadTimeUseCase } from "../usecases/queries/get-next-upload-time.usecase";
import { ListGroupQueueUseCase } from "../usecases/queries/list-group-queue.usecase";
import { ListGroupsUseCase } from "../usecases/queries/list-groups.usecase";
import type { AddGroupDestinationDto } from "../dtos/add-group-destination.dto";
import type { CreateGroupDto } from "../dtos/create-group.dto";
import type { CreateUploadJobsDto } from "../dtos/create-upload-jobs.dto";
import type { EnqueueGroupUploadDto } from "../dtos/enqueue-group-upload.dto";
import type { RenameGroupDto } from "../dtos/rename-group.dto";
import type { UpdateGroupUploadSettingsDto } from "../dtos/update-group-upload-settings.dto";

function requestBaseUrl(req: Request) {
  return `${req.protocol}://${req.get("host")}`;
}

function statusFromError(err: unknown) {
  const status = (err as Error & { status?: number })?.status;
  return typeof status === "number" ? status : 400;
}

@Controller()
export class GroupsController {
  constructor(
    private readonly listGroups: ListGroupsUseCase,
    private readonly createGroup: CreateGroupUseCase,
    private readonly renameGroup: RenameGroupUseCase,
    private readonly removeGroup: RemoveGroupUseCase,
    private readonly addGroupDestination: AddGroupDestinationUseCase,
    private readonly removeGroupDestination: RemoveGroupDestinationUseCase,
    private readonly getGroupHistory: GetGroupHistoryUseCase,
    private readonly listGroupQueue: ListGroupQueueUseCase,
    private readonly enqueueGroupUpload: EnqueueGroupUploadUseCase,
    private readonly removeGroupQueueItem: RemoveGroupQueueItemUseCase,
    private readonly getGroupUploadSettings: GetGroupUploadSettingsUseCase,
    private readonly getNextUploadTime: GetNextUploadTimeUseCase,
    private readonly updateGroupUploadSettings: UpdateGroupUploadSettingsUseCase,
    private readonly createGroupUploadJobs: CreateGroupUploadJobsUseCase,
  ) {}

  @Get(["groups", "combos"])
  list() {
    return this.listGroups.execute();
  }

  @Post(["groups", "combos"])
  async create(@Body() body: CreateGroupDto, @Res({ passthrough: true }) res: Response) {
    try {
      res.status(201);
      return await this.createGroup.execute(body);
    } catch (err) {
      res.status(statusFromError(err));
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }

  @Patch(["groups/:id", "combos/:id"])
  async rename(@Param("id") id: string, @Body() body: RenameGroupDto, @Res({ passthrough: true }) res: Response) {
    try {
      const updated = await this.renameGroup.execute(id, body);
      if (!updated) {
        res.status(404);
        return { error: "Not found" };
      }
      return updated;
    } catch (err) {
      res.status(400);
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }

  @Delete(["groups/:id", "combos/:id"])
  @HttpCode(204)
  remove(@Param("id") id: string) {
    return this.removeGroup.execute(id);
  }

  @Post(["groups/:id/destinations", "combos/:id/destinations"])
  async addDestination(
    @Param("id") id: string,
    @Body() body: AddGroupDestinationDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      res.status(201);
      return await this.addGroupDestination.execute(id, body.destinationId);
    } catch (err) {
      res.status(statusFromError(err));
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }

  @Delete(["groups/:id/destinations/:destinationId", "combos/:id/destinations/:destinationId"])
  @HttpCode(204)
  removeDestination(@Param("id") id: string, @Param("destinationId") destinationId: string) {
    return this.removeGroupDestination.execute(id, destinationId);
  }

  @Get(["groups/:id/history", "combos/:id/history"])
  history(@Param("id") id: string, @Query("limit") limit: string | undefined, @Req() req: Request) {
    return this.getGroupHistory.execute(id, Number(limit ?? 100), requestBaseUrl(req));
  }

  @Get(["groups/:id/queue", "combos/:id/queue"])
  async listQueue(@Param("id") id: string, @Res({ passthrough: true }) res: Response) {
    try {
      return await this.listGroupQueue.execute(id);
    } catch (err) {
      res.status(statusFromError(err));
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }

  @Post(["groups/:id/queue", "combos/:id/queue"])
  async enqueueUpload(
    @Param("id") id: string,
    @Body() body: EnqueueGroupUploadDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      res.status(201);
      const item = await this.enqueueGroupUpload.execute(id, body);
      return { ...item, queueLink: new URL(`/groups/${id}/queue`, requestBaseUrl(req)).toString() };
    } catch (err) {
      res.status(statusFromError(err));
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }

  @Delete(["groups/:id/queue/:itemId", "combos/:id/queue/:itemId"])
  @HttpCode(204)
  removeQueueItem(@Param("id") id: string, @Param("itemId") itemId: string) {
    return this.removeGroupQueueItem.execute(id, itemId);
  }

  @Get(["groups/:id/queue-settings", "combos/:id/queue-settings"])
  async getUploadSettings(@Param("id") id: string, @Res({ passthrough: true }) res: Response) {
    try {
      return await this.getGroupUploadSettings.execute(id);
    } catch (err) {
      res.status(statusFromError(err));
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }

  @Get(["groups/:id/next-upload-time", "combos/:id/next-upload-time"])
  async getNextUpload(@Param("id") id: string, @Res({ passthrough: true }) res: Response) {
    try {
      return await this.getNextUploadTime.execute(id);
    } catch (err) {
      res.status(statusFromError(err));
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }

  @Patch(["groups/:id/queue-settings", "combos/:id/queue-settings"])
  async updateUploadSettings(
    @Param("id") id: string,
    @Body() body: UpdateGroupUploadSettingsDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      return await this.updateGroupUploadSettings.execute(id, body);
    } catch (err) {
      res.status(statusFromError(err));
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }

  @Post(["groups/:id/upload", "combos/:id/upload"])
  async uploadByPath(
    @Param("id") id: string,
    @Body()
    body: CreateUploadJobsDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      return await this.createGroupUploadJobs.execute(id, body, requestBaseUrl(req));
    } catch (err) {
      res.status(400);
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }
}
