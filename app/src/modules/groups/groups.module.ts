import { Module } from "@nestjs/common";
import { GroupsController } from "./api/groups.controller";
import { AddGroupDestinationUseCase } from "./usecases/commands/add-group-destination.usecase";
import { CreateGroupUseCase } from "./usecases/commands/create-group.usecase";
import { CreateGroupUploadJobsUseCase } from "./usecases/commands/create-group-upload-jobs.usecase";
import { DispatchNextQueuedGroupUploadUseCase } from "./usecases/commands/dispatch-next-queued-group-upload.usecase";
import { EnqueueGroupUploadUseCase } from "./usecases/commands/enqueue-group-upload.usecase";
import { RemoveGroupUseCase } from "./usecases/commands/remove-group.usecase";
import { RemoveGroupDestinationUseCase } from "./usecases/commands/remove-group-destination.usecase";
import { RemoveGroupQueueItemUseCase } from "./usecases/commands/remove-group-queue-item.usecase";
import { RenameGroupUseCase } from "./usecases/commands/rename-group.usecase";
import { UpdateGroupUploadSettingsUseCase } from "./usecases/commands/update-group-upload-settings.usecase";
import { UpdateGroupTelegramNotifyUseCase } from "./usecases/commands/update-group-telegram-notify.usecase";
import { AddGroupNotificationChannelUseCase } from "./usecases/commands/add-group-notification-channel.usecase";
import { RemoveGroupNotificationChannelUseCase } from "./usecases/commands/remove-group-notification-channel.usecase";
import { ProcessDueGroupQueuesUseCase } from "./usecases/commands/process-due-group-queues.usecase";
import { GetGroupHistoryUseCase } from "./usecases/queries/get-group-history.usecase";
import { GetGroupUploadSettingsUseCase } from "./usecases/queries/get-group-upload-settings.usecase";
import { GetNextUploadTimeUseCase } from "./usecases/queries/get-next-upload-time.usecase";
import { ListGroupQueueUseCase } from "./usecases/queries/list-group-queue.usecase";
import { GetGroupTelegramNotifyUseCase } from "./usecases/queries/get-group-telegram-notify.usecase";
import { ListGroupNotificationChannelsUseCase } from "./usecases/queries/list-group-notification-channels.usecase";
import { GetBatchDetailUseCase } from "./usecases/queries/get-batch-detail.usecase";
import { ListAllHistoryUseCase } from "./usecases/queries/list-all-history.usecase";
import { ListAllSchedulesUseCase } from "./usecases/queries/list-all-schedules.usecase";
import { ListGroupsUseCase } from "./usecases/queries/list-groups.usecase";

@Module({
  controllers: [GroupsController],
  providers: [
    AddGroupDestinationUseCase,
    CreateGroupUseCase,
    CreateGroupUploadJobsUseCase,
    DispatchNextQueuedGroupUploadUseCase,
    EnqueueGroupUploadUseCase,
    RemoveGroupUseCase,
    RemoveGroupDestinationUseCase,
    RemoveGroupQueueItemUseCase,
    RenameGroupUseCase,
    UpdateGroupUploadSettingsUseCase,
    UpdateGroupTelegramNotifyUseCase,
    AddGroupNotificationChannelUseCase,
    RemoveGroupNotificationChannelUseCase,
    ProcessDueGroupQueuesUseCase,
    GetGroupTelegramNotifyUseCase,
    ListGroupNotificationChannelsUseCase,
    GetGroupHistoryUseCase,
    GetGroupUploadSettingsUseCase,
    GetNextUploadTimeUseCase,
    GetBatchDetailUseCase,
    ListAllHistoryUseCase,
    ListAllSchedulesUseCase,
    ListGroupQueueUseCase,
    ListGroupsUseCase,
  ],
})
export class GroupsModule {}
