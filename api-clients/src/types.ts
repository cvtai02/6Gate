export type ProviderDto = {
  id: string;
  name: string;
  type: string;
  clientId: string | null;
  scopes: string | null;
  createdAt: string;
};

export type AccountDto = {
  id: string;
  providerId: string;
  providerAccountId?: string | null;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  scopes: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt?: string;
  providerName?: string | null;
  providerType?: string | null;
};

export type AddTelegramAccountDto = {
  providerId?: string;
  name?: string;
  botToken: string;
  chatId?: string;
  chatName?: string;
};

export type AddTelegramChatDto = {
  chatId: string;
  chatName?: string;
};

export type PublishDestinationDto = {
  id: string;
  socialAccountId: string;
  name: string;
  type: string;
  externalId: string | null;
  avatarUrl: string | null;
  accountUsername?: string | null;
  accountAvatarUrl?: string | null;
  providerType?: string | null;
  providerName?: string | null;
};

export type GroupDestinationDto = PublishDestinationDto & {
  destinationId: string;
};

export type GroupDto = {
  id: string;
  name: string;
  createdAt: string;
  destinations: GroupDestinationDto[];
};

export type JobDto = {
  id: string;
  accountId?: string;
  destinationId?: string | null;
  groupId?: string | null;
  uploadBatchId?: string | null;
  platform: string;
  status: string;
  videoPath?: string;
  title: string | null;
  caption: string | null;
  privacy?: string | null;
  scheduledAt: string | null;
  providerPostId?: string | null;
  providerPostUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type JobLogDto = {
  id: string;
  jobId: string;
  level: string;
  message: string;
  createdAt: string;
};

export type GroupHistoryJobDto = {
  id: string;
  status: string;
  providerPostUrl: string | null;
  errorMessage: string | null;
  updatedAt: string;
  destinationId: string | null;
  destinationName: string | null;
  destinationType: string | null;
  destinationAvatar: string | null;
  accountAvatar: string | null;
  providerType: string | null;
  destinationIcon: string | null;
};

export type GroupHistoryBatchDto = {
  id: string;
  title: string | null;
  caption: string | null;
  privacy: string | null;
  scheduledAt: string | null;
  videoPath: string | null;
  createdAt: string;
  updatedAt: string;
  jobs: GroupHistoryJobDto[];
};

export type GroupHistoryDto = {
  groupId: string;
  batches: GroupHistoryBatchDto[];
};

export type EnqueueGroupUploadDto = {
  videoPath?: string;
  title?: string;
  caption?: string;
  privacy?: string;
  scheduledAt?: string;
};

export type GroupUploadQueueItemDto = {
  id: string;
  groupId: string;
  videoPath: string;
  title: string | null;
  caption: string | null;
  privacy: string | null;
  scheduledAt: string | null;
  status: string;
  uploadBatchId: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GroupUploadSettingsDto = {
  groupId: string;
  uploadTimeInDay: string;
  lastTriggeredDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UpdateGroupUploadSettingsDto = {
  uploadTimeInDay?: string;
};

export type RuntimeSettingDto = {
  key: string;
  value: string;
  updatedAt: string;
};
