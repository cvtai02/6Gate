type WebhookLogEntry = {
  id: number;
  accountId: string;
  timestamp: string;
  update: unknown;
  result: string;
};

const MAX_ENTRIES = 100;
const entries: WebhookLogEntry[] = [];
let nextId = 1;

export function addWebhookLog(accountId: string, update: unknown, result: string) {
  entries.push({
    id: nextId++,
    accountId,
    timestamp: new Date().toISOString(),
    update,
    result,
  });
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
}

export function getWebhookLogs(): WebhookLogEntry[] {
  return [...entries].reverse();
}

export function clearWebhookLogs() {
  entries.length = 0;
}
