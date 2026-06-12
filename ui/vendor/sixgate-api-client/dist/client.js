export class SixGateApiClient {
    baseUrl;
    fetchImpl;
    constructor(options = {}) {
        this.baseUrl = (options.baseUrl ?? "").replace(/\/+$/, "");
        this.fetchImpl = options.fetchImpl ?? fetch;
    }
    async request(path, init = {}) {
        const res = await this.fetchImpl(`${this.baseUrl}${path}`, init);
        if (!res.ok) {
            const body = await res.json().catch(() => null);
            throw new Error(body?.error ?? `Request failed (${res.status})`);
        }
        if (res.status === 204)
            return undefined;
        return res.json();
    }
    get(path) {
        return this.request(path);
    }
    post(path, body) {
        return this.request(path, {
            method: "POST",
            headers: body instanceof FormData ? undefined : { "Content-Type": "application/json" },
            body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
        });
    }
    patch(path, body) {
        return this.request(path, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
    }
    delete(path) {
        return this.request(path, { method: "DELETE" });
    }
    listSettings() {
        return this.get("/settings");
    }
    updateSetting(key, value) {
        return this.patch(`/settings/${encodeURIComponent(key)}`, { value });
    }
    listProviders() {
        return this.get("/providers");
    }
    createProvider(body) {
        return this.post("/providers", body);
    }
    updateProvider(id, body) {
        return this.patch(`/providers/${encodeURIComponent(id)}`, body);
    }
    deleteProvider(id) {
        return this.delete(`/providers/${encodeURIComponent(id)}`);
    }
    listAccounts(query = "") {
        return this.get(`/accounts${query}`);
    }
    addZernioAccount(body) {
        return this.post("/accounts/zernio/add", body);
    }
    addTelegramAccount(body) {
        return this.post("/accounts/telegram/add", body);
    }
    addTelegramChat(accountId, body) {
        return this.post(`/accounts/${encodeURIComponent(accountId)}/telegram/chats`, body);
    }
    syncZernioAccounts(body) {
        return this.post("/accounts/zernio/sync", body);
    }
    deleteAccount(id) {
        return this.delete(`/accounts/${encodeURIComponent(id)}`);
    }
    listDestinations(query = "") {
        return this.get(`/publish-destinations${query}`);
    }
    listGroups() {
        return this.get("/groups");
    }
    createGroup(name) {
        return this.post("/groups", { name });
    }
    getGroupHistory(id) {
        return this.get(`/groups/${encodeURIComponent(id)}/history`);
    }
    uploadGroupByPath(id, body) {
        return this.post(`/groups/${encodeURIComponent(id)}/upload-by-path`, body);
    }
    uploadGroupFile(id, body) {
        return this.post(`/groups/${encodeURIComponent(id)}/upload-file`, body);
    }
    enqueueGroupFile(id, body) {
        return this.post(`/groups/${encodeURIComponent(id)}/queue-file`, body);
    }
    listJobs() {
        return this.get("/post-jobs");
    }
    getJob(id) {
        return this.get(`/post-jobs/${encodeURIComponent(id)}`);
    }
    cancelJob(id) {
        return this.post(`/post-jobs/${encodeURIComponent(id)}/cancel`);
    }
    retryJob(id) {
        return this.post(`/post-jobs/${encodeURIComponent(id)}/retry`);
    }
}
export const apiClient = new SixGateApiClient();
