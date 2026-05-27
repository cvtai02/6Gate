# 6Gate — Social Gateway App Plan

## 1. Purpose

6Gate is a local-first Social Gateway app.

The goal is simple:

- Other local apps call one local API.
- 6Gate handles login, account tokens, upload, posting, status, retry, and logs.
- Multiple providers can be connected.
- Each provider can have multiple accounts.
- Everything runs locally on port `20129`.

Default server:

```txt
http://localhost:20129
```

Default database path:

```txt
$DATA_DIR/db/data.sqlite
```

---

## 2. Stack

```txt
Next.js 16
React 19
Tailwind CSS 4
SQLite
SSE
Port: 20129
DB: $DATA_DIR/db/data.sqlite
```

Why this stack:

- Next.js gives UI + API routes in one app.
- SQLite is enough for local-first storage.
- SSE is simple for live job logs.
- Tailwind keeps UI fast to build.
- One port makes integration easy for other apps.

---

## 3. Architecture

```txt
External App / CLI
        ↓
6Gate Local API :20129
        ↓
Post Job Service
        ↓
SQLite Job Queue
        ↓
Provider Adapter Layer
        ↓
YouTube / TikTok / Facebook / Instagram
```

Main parts:

```txt
UI Dashboard
Local REST API
OAuth Account Manager
Provider Config Manager
SQLite Database
Job Runner
Provider Adapters
SSE Log Stream
```

---

## 4. MVP Providers

Start with these providers:

```txt
YouTube
TikTok
Facebook Page
Instagram
```

Important note:

Each provider has different OAuth rules, scopes, upload flow, limits, and review requirements. Build provider adapters separately so one platform does not pollute the whole app.

---

## 5. Core Features

### MVP

```txt
1. Add provider config
2. OAuth login account
3. List connected accounts
4. Submit video post job
5. Upload video to provider
6. Show job status
7. Stream job logs with SSE
8. Retry failed job
9. Remove account/token
```

### Later

```txt
Schedule post
Bulk post
Caption templates
Hashtag templates
Thumbnail upload
Post history
Rate limit tracking
Token refresh monitor
Webhook/callback support
```

---

## 6. Data Directory

Use environment variable:

```env
PORT=20129
DATA_DIR=C:/Users/<you>/AppData/Local/6Gate
DATABASE_URL=file:C:/Users/<you>/AppData/Local/6Gate/db/data.sqlite
```

Recommended local layout:

```txt
$DATA_DIR/
  db/
    data.sqlite
  uploads/
    temp/
  logs/
  config/
```

---

## 7. SQLite Schema

```sql
CREATE TABLE providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  client_id TEXT,
  client_secret TEXT,
  auth_url TEXT,
  token_url TEXT,
  scopes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  provider_account_id TEXT,
  display_name TEXT,
  username TEXT,
  avatar_url TEXT,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TEXT,
  scopes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (provider_id) REFERENCES providers(id)
);

CREATE TABLE post_jobs (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  status TEXT NOT NULL,
  video_path TEXT NOT NULL,
  title TEXT,
  caption TEXT,
  privacy TEXT,
  scheduled_at TEXT,
  provider_post_id TEXT,
  provider_post_url TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);

CREATE TABLE job_logs (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (job_id) REFERENCES post_jobs(id)
);
```

Recommended status values:

```txt
queued
running
completed
failed
cancelled
```

Recommended provider types:

```txt
youtube
tiktok
facebook
instagram
mock
```

---

## 8. API Design

### Health

```http
GET /api/health
```

Response:

```json
{
  "ok": true,
  "app": "6Gate",
  "port": 20129
}
```

---

### Providers

```http
GET /api/providers
POST /api/providers
DELETE /api/providers/:id
```

Create provider request:

```json
{
  "name": "YouTube Main",
  "type": "youtube",
  "clientId": "xxx",
  "clientSecret": "xxx",
  "scopes": [
    "https://www.googleapis.com/auth/youtube.upload"
  ]
}
```

---

### Accounts

```http
GET /api/accounts
POST /api/accounts/oauth/start
GET /api/accounts/oauth/callback
DELETE /api/accounts/:id
```

Start OAuth request:

```json
{
  "providerId": "provider_youtube_main"
}
```

---

### Post Jobs

```http
POST /api/post-jobs
GET /api/post-jobs
GET /api/post-jobs/:id
POST /api/post-jobs/:id/retry
DELETE /api/post-jobs/:id
```

Create job request:

```json
{
  "accountId": "acc_youtube_main",
  "videoPath": "D:/videos/demo.mp4",
  "title": "Demo video",
  "caption": "My caption #demo",
  "privacy": "private"
}
```

Create job response:

```json
{
  "id": "job_abc123",
  "status": "queued"
}
```

---

### SSE Job Events

```http
GET /api/post-jobs/:id/events
```

Event examples:

```txt
event: log
data: {"level":"info","message":"Uploading video..."}

event: status
data: {"status":"completed"}
```

---

## 9. Provider Adapter Interface

```ts
export type PublishVideoInput = {
  accountId: string;
  videoPath: string;
  title?: string;
  caption?: string;
  privacy?: "private" | "public" | "unlisted";
  scheduledAt?: string;
};

export type PublishVideoResult = {
  providerPostId: string;
  url?: string;
};

export interface SocialProviderAdapter {
  id: string;
  name: string;

  getAuthUrl(providerId: string): Promise<string>;

  handleOAuthCallback(input: {
    providerId: string;
    code: string;
    state?: string;
  }): Promise<void>;

  refreshToken(accountId: string): Promise<void>;

  publishVideo(input: PublishVideoInput): Promise<PublishVideoResult>;

  getPostStatus?(providerPostId: string): Promise<string>;
}
```

Provider folder:

```txt
src/server/providers/
  types.ts
  registry.ts
  mock.adapter.ts
  youtube.adapter.ts
  tiktok.adapter.ts
  facebook.adapter.ts
  instagram.adapter.ts
```

---

## 10. UI Pages

```txt
/
  Dashboard

/accounts
  Connected accounts

/providers
  Provider configs

/post
  Create post job

/jobs
  Job history

/jobs/[id]
  Job detail + live logs

/settings
  App settings
```

Dashboard cards:

```txt
Connected accounts
Pending jobs
Running jobs
Failed jobs
Completed jobs
Recent logs
```

---

## 11. Folder Structure

```txt
6Gate/
  src/
    app/
      api/
        health/
          route.ts
        providers/
          route.ts
          [id]/
            route.ts
        accounts/
          route.ts
          oauth/
            start/
              route.ts
            callback/
              route.ts
          [id]/
            route.ts
        post-jobs/
          route.ts
          [id]/
            route.ts
            retry/
              route.ts
            events/
              route.ts

      accounts/
        page.tsx
      providers/
        page.tsx
      jobs/
        page.tsx
        [id]/
          page.tsx
      post/
        page.tsx
      settings/
        page.tsx
      page.tsx
      layout.tsx

    server/
      config/
        env.ts

      db/
        index.ts
        schema.ts
        migrate.ts
        migrations/

      providers/
        types.ts
        registry.ts
        mock.adapter.ts
        youtube.adapter.ts
        tiktok.adapter.ts
        facebook.adapter.ts
        instagram.adapter.ts

      jobs/
        job-runner.ts
        job-service.ts
        log-service.ts

      auth/
        oauth-service.ts
        token-service.ts

      files/
        path-utils.ts

    components/
      app-sidebar.tsx
      job-status-badge.tsx
      live-log-view.tsx
      provider-card.tsx
      account-card.tsx
      ui/

  data/
  package.json
  next.config.ts
  .env
  README.md
```

---

## 12. MVP Flow

```txt
1. Start 6Gate on port 20129
2. User opens dashboard
3. User adds provider config
4. User connects account with OAuth
5. External app sends videoPath + accountId
6. 6Gate creates post_jobs row
7. Job runner picks queued job
8. Provider adapter uploads video
9. Logs are written to job_logs
10. UI receives live updates through SSE
11. Job becomes completed or failed
```

---

## 13. First Milestone

Build this first:

```txt
Health API
SQLite init
Provider table
Account table
Mock provider adapter
Create post job API
Job logs
SSE log stream
Simple dashboard
```

Do mock provider first.

Mock flow:

```txt
POST /api/post-jobs
→ creates job
→ status queued
→ runner starts
→ status running
→ writes log: preparing video
→ writes log: uploading video
→ waits 2 seconds
→ writes log: mock publish completed
→ status completed
```

This proves the gateway architecture before fighting real provider OAuth and API limits.

---

## 14. Commands

Create project:

```bash
npx create-next-app@latest 6Gate
cd 6Gate
```

Install packages:

```bash
pnpm add better-sqlite3 drizzle-orm zod nanoid
pnpm add -D drizzle-kit @types/better-sqlite3
```

Run dev:

```bash
pnpm dev --port 20129
```

Build:

```bash
pnpm build
```

Run production local:

```bash
pnpm start --port 20129
```

---

## 15. Recommended Build Order

```txt
1. Project setup
2. Env config
3. SQLite connection
4. Tables + migration
5. Health API
6. Provider CRUD
7. Account CRUD
8. Mock adapter
9. Create post job API
10. Job runner
11. Job logs
12. SSE events
13. Dashboard
14. Real YouTube adapter
15. Real TikTok adapter
16. Real Facebook/Instagram adapter
```

---

## 16. Important Design Notes

### Keep tokens local

Tokens should stay in local SQLite only.

For better security later:

```txt
Encrypt access_token
Encrypt refresh_token
Use OS keychain if needed
```

### Keep provider adapters isolated

Do not write TikTok-specific logic inside job service.

Good:

```txt
job-service → adapter.publishVideo()
```

Bad:

```txt
job-service → if platform === "tiktok" then custom logic
```

### Job runner should be simple first

At MVP, one job at a time is enough.

Later:

```txt
parallel workers
retry policy
rate limit awareness
scheduled queue
```

### Static/local mindset

Do not require Docker.

Do not require cloud database.

Do not require external backend.

The app should be usable as a local tool.

---

## 17. Minimum External API Example

Any app can post to 6Gate:

```bash
curl -X POST http://localhost:20129/api/post-jobs \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "acc_youtube_main",
    "videoPath": "D:/videos/demo.mp4",
    "title": "Demo video",
    "caption": "Posted from 6Gate",
    "privacy": "private"
  }'
```

Listen to live logs:

```bash
curl -N http://localhost:20129/api/post-jobs/job_abc123/events
```

---

## 18. MVP Definition of Done

MVP is done when:

```txt
6Gate runs on localhost:20129
SQLite is created at $DATA_DIR/db/data.sqlite
User can add mock provider
User can add mock account
External app can create post job
Job runner can process mock job
UI can show job status
UI can stream logs using SSE
Failed job can be retried
```
