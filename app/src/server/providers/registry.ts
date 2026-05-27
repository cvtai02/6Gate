import type { SocialProviderAdapter } from "./types";
import { YouTubeAdapter } from "./youtube.adapter";
import { TikTokAdapter } from "./tiktok.adapter";
import { FacebookAdapter } from "./facebook.adapter";
import { InstagramAdapter } from "./instagram.adapter";

const adapters = new Map<string, SocialProviderAdapter>();

adapters.set("youtube", new YouTubeAdapter());
adapters.set("tiktok", new TikTokAdapter());
adapters.set("facebook", new FacebookAdapter());
adapters.set("instagram", new InstagramAdapter());

export function getAdapter(type: string): SocialProviderAdapter {
  const adapter = adapters.get(type);
  if (!adapter) throw new Error(`No adapter for provider type: ${type}`);
  return adapter;
}

export function listAdapterTypes(): string[] {
  return Array.from(adapters.keys());
}
