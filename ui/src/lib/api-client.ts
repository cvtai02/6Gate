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

export const apiBaseUrl = "http://localhost:20130/api";

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
