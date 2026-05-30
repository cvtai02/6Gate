export const TikTokScope = {
  userInfoBasic: "user.info.basic",
  videoPublish: "video.publish",
  videoUpload: "video.upload",
} as const;
export type TikTokScope = (typeof TikTokScope)[keyof typeof TikTokScope];

export const TIKTOK_SCOPES = Object.values(TikTokScope).join(",");

export const ProviderType = {
  meta: "meta",
  youtube: "youtube",
  tiktok: "tiktok",
} as const;
export type ProviderType = (typeof ProviderType)[keyof typeof ProviderType];

export const DestinationType = {
  facebook_page: "facebook_page",
  youtube_channel: "youtube_channel",
  tiktok_account: "tiktok_account",
  instagram_account: "instagram_account",
  threads_profile: "threads_profile",
} as const;
export type DestinationType = (typeof DestinationType)[keyof typeof DestinationType];

export const PublishStatus = {
  Created: "Created",
  Initializing: "Initializing",
  Uploading: "Uploading",
  Finishing: "Finishing",
  Processing: "Processing",
  Published: "Published",
  Failed: "Failed",
  Retrying: "Retrying",
  ReconnectRequired: "ReconnectRequired",
  Cancelled: "Cancelled",
} as const;
export type PublishStatus = (typeof PublishStatus)[keyof typeof PublishStatus];

/** Statuses where the worker should keep processing this job. */
export const ACTIVE_STATUSES: PublishStatus[] = [
  PublishStatus.Created,
  PublishStatus.Initializing,
  PublishStatus.Uploading,
  PublishStatus.Finishing,
  PublishStatus.Processing,
  PublishStatus.Retrying,
];

/** Statuses the user/UI considers "done". */
export const TERMINAL_STATUSES: PublishStatus[] = [
  PublishStatus.Published,
  PublishStatus.Failed,
  PublishStatus.Cancelled,
];

export const ContentType = {
  Video: "Video",
  Reel: "Reel",
} as const;
export type ContentType = (typeof ContentType)[keyof typeof ContentType];

/** How an error from a platform should be handled. */
export const ErrorKind = {
  /** Transient — bump attemptCount, schedule retry with backoff. */
  Retryable: "Retryable",
  /** Auth/permission failure — user must re-link the account. */
  Reconnect: "Reconnect",
  /** Permanent — do not retry. */
  Permanent: "Permanent",
} as const;
export type ErrorKind = (typeof ErrorKind)[keyof typeof ErrorKind];

export const Providers = {
  [ProviderType.meta]: {
    id: ProviderType.meta,
    name: "Meta",
    destinations: [DestinationType.facebook_page, DestinationType.instagram_account, DestinationType.threads_profile],
  },
  [ProviderType.youtube]: {
    id: ProviderType.youtube,
    name: "YouTube",
    destinations: [DestinationType.youtube_channel],
  },
  [ProviderType.tiktok]: {
    id: ProviderType.tiktok,
    name: "TikTok",
    destinations: [DestinationType.tiktok_account],
  },
} as const;
