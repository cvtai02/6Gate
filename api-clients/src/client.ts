export type ApiClientOptions = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

import type {
  AccountDto,
  GroupDto,
  GroupHistoryDto,
  JobDto,
  ProviderDto,
  PublishDestinationDto,
  RuntimeSettingDto,
} from "./types";

export class SixGateApiClient {
  readonly baseUrl: string;
  readonly fetchImpl: typeof fetch;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "").replace(/\/+$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, init);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error ?? `Request failed (${res.status})`);
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  get<T>(path: string) {
    return this.request<T>(path);
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: "POST",
      headers: body instanceof FormData ? undefined : { "Content-Type": "application/json" },
      body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
    });
  }

  patch<T>(path: string, body: unknown) {
    return this.request<T>(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  delete<T>(path: string) {
    return this.request<T>(path, { method: "DELETE" });
  }

  listSettings() {
    return this.get<RuntimeSettingDto[]>("/settings");
  }

  updateSetting(key: string, value: string) {
    return this.patch<RuntimeSettingDto>(`/settings/${encodeURIComponent(key)}`, { value });
  }

  listProviders() {
    return this.get<ProviderDto[]>("/providers");
  }

  createProvider(body: unknown) {
    return this.post<ProviderDto>("/providers", body);
  }

  updateProvider(id: string, body: unknown) {
    return this.patch<ProviderDto>(`/providers/${encodeURIComponent(id)}`, body);
  }

  deleteProvider(id: string) {
    return this.delete<void>(`/providers/${encodeURIComponent(id)}`);
  }

  listAccounts(query = "") {
    return this.get<AccountDto[]>(`/accounts${query}`);
  }

  addZernioAccount(body: unknown) {
    return this.post<AccountDto>("/accounts/zernio/add", body);
  }

  syncZernioAccounts(body?: unknown) {
    return this.post<unknown>("/accounts/zernio/sync", body);
  }

  deleteAccount(id: string) {
    return this.delete<void>(`/accounts/${encodeURIComponent(id)}`);
  }

  listDestinations(query = "") {
    return this.get<PublishDestinationDto[]>(`/publish-destinations${query}`);
  }

  listGroups() {
    return this.get<GroupDto[]>("/groups");
  }

  createGroup(name: string) {
    return this.post<GroupDto>("/groups", { name });
  }

  getGroupHistory(id: string) {
    return this.get<GroupHistoryDto>(`/groups/${encodeURIComponent(id)}/history`);
  }

  uploadGroupByPath(id: string, body: unknown) {
    return this.post<unknown>(`/groups/${encodeURIComponent(id)}/upload-by-path`, body);
  }

  listJobs() {
    return this.get<JobDto[]>("/post-jobs");
  }

  getJob(id: string) {
    return this.get<JobDto & { logs?: unknown[] }>(`/post-jobs/${encodeURIComponent(id)}`);
  }

  cancelJob(id: string) {
    return this.post<unknown>(`/post-jobs/${encodeURIComponent(id)}/cancel`);
  }

  retryJob(id: string) {
    return this.post<unknown>(`/post-jobs/${encodeURIComponent(id)}/retry`);
  }
}

export const apiClient = new SixGateApiClient();
