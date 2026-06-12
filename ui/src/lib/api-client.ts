import { SixGateApiClient } from "@sixgate/api-client";
export type {
  AccountDto,
  GroupDto,
  GroupHistoryDto,
  JobDto,
  JobLogDto,
  ProviderDto,
  PublishDestinationDto,
  RuntimeSettingDto,
} from "@sixgate/api-client";

// Server-side base URL for the NestJS API. In production (e.g. Vercel) set
// API_BASE_URL to the public API origin, e.g. https://api.6gate.minfect.com.
const API_ORIGIN = process.env.API_BASE_URL ?? process.env.API_URL ?? "http://localhost:20130";
export const apiBaseUrl = `${API_ORIGIN}/api`;

export function createServerApiClient() {
  return new SixGateApiClient({
    baseUrl: apiBaseUrl,
    fetchImpl: ((input, init) =>
      fetch(input, {
        ...init,
        cache: "no-store",
      })) as typeof fetch,
  });
}
