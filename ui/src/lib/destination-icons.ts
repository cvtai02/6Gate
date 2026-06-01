const DESTINATION_ICON_PATHS: Record<string, string> = {
  youtube: "/icons/youtube.svg",
  youtube_channel: "/icons/youtube.svg",
  facebook: "/icons/facebook.svg",
  facebook_page: "/icons/facebook.svg",
  instagram: "/icons/instagram.svg",
  instagram_account: "/icons/instagram.svg",
  tiktok: "/icons/tiktok.svg",
  tiktok_account: "/icons/tiktok.svg",
};

export function getDestinationIconPath(type?: string | null, providerType?: string | null) {
  if (type && DESTINATION_ICON_PATHS[type]) return DESTINATION_ICON_PATHS[type];
  if (providerType && DESTINATION_ICON_PATHS[providerType]) return DESTINATION_ICON_PATHS[providerType];
  return null;
}

export function getDestinationIconUrl(
  baseUrl: string | URL,
  type?: string | null,
  providerType?: string | null
) {
  const path = getDestinationIconPath(type, providerType);
  return path ? new URL(path, baseUrl).toString() : null;
}
