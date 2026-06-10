export type ApiClientOptions = {
    baseUrl?: string;
    fetchImpl?: typeof fetch;
};
import type { AccountDto, AddTelegramChatDto, AddTelegramAccountDto, GroupDto, GroupHistoryDto, JobDto, ProviderDto, PublishDestinationDto, RuntimeSettingDto } from "./types";
export declare class SixGateApiClient {
    readonly baseUrl: string;
    readonly fetchImpl: typeof fetch;
    constructor(options?: ApiClientOptions);
    request<T>(path: string, init?: RequestInit): Promise<T>;
    get<T>(path: string): Promise<T>;
    post<T>(path: string, body?: unknown): Promise<T>;
    patch<T>(path: string, body: unknown): Promise<T>;
    delete<T>(path: string): Promise<T>;
    listSettings(): Promise<RuntimeSettingDto[]>;
    updateSetting(key: string, value: string): Promise<RuntimeSettingDto>;
    listProviders(): Promise<ProviderDto[]>;
    createProvider(body: unknown): Promise<ProviderDto>;
    updateProvider(id: string, body: unknown): Promise<ProviderDto>;
    deleteProvider(id: string): Promise<void>;
    listAccounts(query?: string): Promise<AccountDto[]>;
    addZernioAccount(body: unknown): Promise<AccountDto>;
    addTelegramAccount(body: AddTelegramAccountDto): Promise<AccountDto>;
    addTelegramChat(accountId: string, body: AddTelegramChatDto): Promise<PublishDestinationDto>;
    syncZernioAccounts(body?: unknown): Promise<unknown>;
    deleteAccount(id: string): Promise<void>;
    listDestinations(query?: string): Promise<PublishDestinationDto[]>;
    listGroups(): Promise<GroupDto[]>;
    createGroup(name: string): Promise<GroupDto>;
    getGroupHistory(id: string): Promise<GroupHistoryDto>;
    uploadGroupByPath(id: string, body: unknown): Promise<unknown>;
    listJobs(): Promise<JobDto[]>;
    getJob(id: string): Promise<JobDto & {
        logs?: unknown[];
    }>;
    cancelJob(id: string): Promise<unknown>;
    retryJob(id: string): Promise<unknown>;
}
export declare const apiClient: SixGateApiClient;
