import type { SocialProviderAdapter } from "./types";
import { YouTubeAdapter } from "./youtube.adapter";
import { TikTokAdapter } from "./tiktok.adapter";
import { FacebookAdapter } from "./facebook.adapter";
import { ZernioAdapter } from "./zernio.adapter";
import { TelegramAdapter } from "./telegram.adapter";
import { ProviderType } from "@/core/enums";

const adapters = new Map<string, SocialProviderAdapter>();

adapters.set(ProviderType.youtube, new YouTubeAdapter());
adapters.set(ProviderType.tiktok, new TikTokAdapter());
adapters.set(ProviderType.meta, new FacebookAdapter());
adapters.set(ProviderType.zernio, new ZernioAdapter());
adapters.set(ProviderType.telegram, new TelegramAdapter());

export function getAdapter(type: string): SocialProviderAdapter {
  const adapter = adapters.get(type);
  if (!adapter) throw new Error(`No adapter for provider type: ${type}`);
  return adapter;
}

export function listAdapterTypes(): string[] {
  return Array.from(adapters.keys());
}
