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
import { UpdateGroupTelegramNotifyUseCase } from "../usecases/commands/update-group-telegram-notify.usecase";
import { GetGroupTelegramNotifyUseCase } from "../usecases/queries/get-group-telegram-notify.usecase";
import { AddGroupNotificationChannelUseCase } from "../usecases/commands/add-group-notification-channel.usecase";
import { RemoveGroupNotificationChannelUseCase } from "../usecases/commands/remove-group-notification-channel.usecase";
import { ListGroupNotificationChannelsUseCase } from "../usecases/queries/list-group-notification-channels.usecase";
import { ListAllSchedulesUseCase } from "../usecases/queries/list-all-schedules.usecase";
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
import type { UpdateGroupTelegramNotifyDto } from "../dtos/update-group-telegram-notify.dto";

function requestBaseUrl(req: Request) {
  return `${req.protocol}://${req.get("host")}`;
}

function statusFromError(err: unknown) {
  const status = (err as Error & { status?: number })?.status;
  return typeof status === "number" ? status : 400;
}

function errorBody(err: unknown) {
  return { error: err instanceof Error ? err.message : String(err) };
}

async function handleRequest<T>(
  res: Response,
  fn: () => Promise<T>,
  successStatus?: number,
): Promise<T | { error: string }> {
  try {
    if (successStatus) res.status(successStatus);
    return await fn();
  } catch (err) {
    res.status(statusFromError(err));
    return errorBody(err);
  }
}

@Controller()
export class GroupsController {
  constructor(
    private readonly listAllSchedules: ListAllSchedulesUseCase,
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
    private readonly getGroupTelegramNotify: GetGroupTelegramNotifyUseCase,
    private readonly updateGroupTelegramNotify: UpdateGroupTelegramNotifyUseCase,
    private readonly addGroupNotificationChannel: AddGroupNotificationChannelUseCase,
    private readonly removeGroupNotificationChannel: RemoveGroupNotificationChannelUseCase,
    private readonly listGroupNotificationChannels: ListGroupNotificationChannelsUseCase,
  ) {}

  @Get("schedules")
  schedules() {
    return this.listAllSchedules.execute();
  }

  @Get(["groups", "combos"])
  list() {
    return this.listGroups.execute();
  }

  @Post(["groups", "combos"])
  async create(@Body() body: CreateGroupDto, @Res({ passthrough: true }) res: Response) {
    return handleRequest(res, () => this.createGroup.execute(body), 201);
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
    return handleRequest(res, () => this.addGroupDestination.execute(id, body.destinationId), 201);
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
    return handleRequest(res, () => this.listGroupQueue.execute(id));
  }

  @Post(["groups/:id/queue", "combos/:id/queue"])
  async enqueueUpload(
    @Param("id") id: string,
    @Body() body: EnqueueGroupUploadDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return handleRequest(res, async () => {
      const item = await this.enqueueGroupUpload.execute(id, body);
      return { ...item, queueLink: new URL(`/groups/${id}/queue`, requestBaseUrl(req)).toString() };
    }, 201);
  }

  @Delete(["groups/:id/queue/:itemId", "combos/:id/queue/:itemId"])
  @HttpCode(204)
  removeQueueItem(@Param("id") id: string, @Param("itemId") itemId: string) {
    return this.removeGroupQueueItem.execute(id, itemId);
  }

  @Get(["groups/:id/queue-settings", "combos/:id/queue-settings"])
  async getUploadSettings(@Param("id") id: string, @Res({ passthrough: true }) res: Response) {
    return handleRequest(res, () => this.getGroupUploadSettings.execute(id));
  }

  @Get(["groups/:id/next-upload-time", "combos/:id/next-upload-time"])
  async getNextUpload(@Param("id") id: string, @Res({ passthrough: true }) res: Response) {
    return handleRequest(res, () => this.getNextUploadTime.execute(id));
  }

  @Patch(["groups/:id/queue-settings", "combos/:id/queue-settings"])
  async updateUploadSettings(
    @Param("id") id: string,
    @Body() body: UpdateGroupUploadSettingsDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return handleRequest(res, () => this.updateGroupUploadSettings.execute(id, body));
  }

  @Post(["groups/:id/upload", "combos/:id/upload"])
  async uploadByPath(
    @Param("id") id: string,
    @Body()
    body: CreateUploadJobsDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return handleRequest(res, () => this.createGroupUploadJobs.execute(id, body, requestBaseUrl(req)));
  }

  @Get(["groups/:id/telegram-notify", "combos/:id/telegram-notify"])
  async getTelegramNotify(@Param("id") id: string, @Res({ passthrough: true }) res: Response) {
    return handleRequest(res, () => this.getGroupTelegramNotify.execute(id));
  }

  @Patch(["groups/:id/telegram-notify", "combos/:id/telegram-notify"])
  async setTelegramNotify(
    @Param("id") id: string,
    @Body() body: UpdateGroupTelegramNotifyDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return handleRequest(res, () => this.updateGroupTelegramNotify.execute(id, body));
  }

  @Get(["groups/:id/notification-channels", "combos/:id/notification-channels"])
  async listNotificationChannels(@Param("id") id: string, @Res({ passthrough: true }) res: Response) {
    return handleRequest(res, () => this.listGroupNotificationChannels.execute(id));
  }

  @Post(["groups/:id/notification-channels", "combos/:id/notification-channels"])
  async addNotificationChannel(
    @Param("id") id: string,
    @Body() body: { accountId: string; chatId: string; chatName?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    return handleRequest(res, () => this.addGroupNotificationChannel.execute(id, body), 201);
  }

  @Delete(["groups/:id/notification-channels/:channelId", "combos/:id/notification-channels/:channelId"])
  async removeNotificationChannel(
    @Param("id") id: string,
    @Param("channelId") channelId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    return handleRequest(res, () => this.removeGroupNotificationChannel.execute(id, channelId));
  }

}
