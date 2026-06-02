export interface GroupUploadQueueItemDto {
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
}

export interface GroupUploadSettingsDto {
  groupId: string;
  uploadTimeInDay: string;
  lastTriggeredDate: string | null;
  createdAt: string;
  updatedAt: string;
}
