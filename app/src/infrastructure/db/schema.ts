import { pgTable, text } from "drizzle-orm/pg-core";

// NOTE: Postgres migration. All columns are kept as `text` (matching the original
// SQLite design where numbers/dates were stored as ISO/encoded strings) so the
// one-time data import from the old SQLite file is a straight value copy.
// Foreign keys are intentionally NOT declared here — integrity is enforced at the
// application layer, same as the original schema.

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const providers = pgTable("providers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  clientId: text("client_id"),
  clientSecret: text("client_secret"),
  authUrl: text("auth_url"),
  tokenUrl: text("token_url"),
  scopes: text("scopes"),
  pkceVerifier: text("pkce_verifier"),
  createdAt: text("created_at").notNull(),
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  providerId: text("provider_id").notNull(),
  providerAccountId: text("provider_account_id"),
  displayName: text("display_name"),
  username: text("username"),
  avatarUrl: text("avatar_url"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  expiresAt: text("expires_at"),
  scopes: text("scopes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const postJobs = pgTable("post_jobs", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  destinationId: text("destination_id"),
  platform: text("platform").notNull(),
  /** Video | Reel — Reel currently only applies to Meta/Facebook Page. */
  contentType: text("content_type"),
  /** PublishStatus enum (see lib/enums.ts). */
  status: text("status").notNull(),
  groupId: text("group_id"),
  uploadBatchId: text("upload_batch_id"),
  videoPath: text("video_path").notNull(),
  title: text("title"),
  caption: text("caption"),
  privacy: text("privacy"),
  scheduledAt: text("scheduled_at"),

  // Provider-side handles captured during the publish flow.
  providerPostId: text("provider_post_id"),       // TikTok publish_id (later post_id), YouTube videoId, FB video_id
  providerPostUrl: text("provider_post_url"),
  uploadSessionId: text("upload_session_id"),     // FB Page video chunked upload session
  uploadSessionUrl: text("upload_session_url"),   // YouTube resumable upload URL
  uploadUrl: text("upload_url"),                  // FB Reel rupload URL
  startOffset: text("start_offset"),              // FB chunked transfer cursor (string in API)
  endOffset: text("end_offset"),

  // Progress
  uploadedBytes: text("uploaded_bytes"),          // stored as text to avoid int64 round-trip
  totalBytes: text("total_bytes"),

  // Retry & status-poll bookkeeping
  attemptCount: text("attempt_count"),            // string-encoded int
  maxAttempts: text("max_attempts"),
  nextAttemptAt: text("next_attempt_at"),
  lastStatusCheckedAt: text("last_status_checked_at"),

  // Error detail
  errorMessage: text("error_message"),
  lastErrorCode: text("last_error_code"),
  lastErrorSubcode: text("last_error_subcode"),
  lastNetworkError: text("last_network_error"),
  lastTraceId: text("last_trace_id"),
  reconnectRequiredReason: text("reconnect_required_reason"),

  // Idempotency — unique constraint enforced in migrate.ts
  idempotencyKey: text("idempotency_key"),

  publishedAt: text("published_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const videoFolders = pgTable("video_folders", {
  id: text("id").primaryKey(),
  path: text("path").notNull(),
  label: text("label"),
  createdAt: text("created_at").notNull(),
});

export const jobLogs = pgTable("job_logs", {
  id: text("id").primaryKey(),
  jobId: text("job_id").notNull(),
  level: text("level").notNull(),
  message: text("message").notNull(),
  createdAt: text("created_at").notNull(),
});

export const groups = pgTable("combos", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
});

export const groupNotificationChannels = pgTable("group_notification_channels", {
  id: text("id").primaryKey(),
  groupId: text("group_id").notNull(),
  accountId: text("account_id").notNull(),
  chatId: text("chat_id").notNull(),
  chatName: text("chat_name"),
  createdAt: text("created_at").notNull(),
});

export const destinations = pgTable("destinations", {
  id: text("id").primaryKey(),
  socialAccountId: text("social_account_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // youtube_channel | facebook_page | tiktok_account | TelegramChat
  externalId: text("external_id"),
  /** Page-level access token (Meta only). Stored here so one user account can hold many pages. */
  accessToken: text("access_token"),
  /** Page/channel/account avatar URL for this destination. */
  avatarUrl: text("avatar_url"),
  createdAt: text("created_at").notNull(),
});

export const groupDestinations = pgTable("combo_destinations", {
  id: text("id").primaryKey(),
  groupId: text("combo_id").notNull(),
  destinationId: text("destination_id").notNull(),
  createdAt: text("created_at").notNull(),
});

export const groupUploadQueue = pgTable("group_upload_queue", {
  id: text("id").primaryKey(),
  groupId: text("group_id").notNull(),
  videoPath: text("video_path").notNull(),
  title: text("title"),
  caption: text("caption"),
  privacy: text("privacy"),
  status: text("status").notNull(),
  uploadBatchId: text("upload_batch_id"),
  errorMessage: text("error_message"),
  sourceChatId: text("source_chat_id"),
  sourceAccountId: text("source_account_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});



export const groupUploadSettings = pgTable("group_upload_settings", {
  groupId: text("group_id").primaryKey(),
  uploadTimeInDay: text("upload_time_in_day").notNull(),
  lastTriggeredDate: text("last_triggered_date"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
