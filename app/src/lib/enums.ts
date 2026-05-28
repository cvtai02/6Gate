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
