import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const providers = sqliteTable("providers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  clientId: text("client_id"),
  clientSecret: text("client_secret"),
  authUrl: text("auth_url"),
  tokenUrl: text("token_url"),
  scopes: text("scopes"),
  createdAt: text("created_at").notNull(),
});

export const accounts = sqliteTable("accounts", {
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

export const postJobs = sqliteTable("post_jobs", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  platform: text("platform").notNull(),
  status: text("status").notNull(),
  videoPath: text("video_path").notNull(),
  title: text("title"),
  caption: text("caption"),
  privacy: text("privacy"),
  scheduledAt: text("scheduled_at"),
  providerPostId: text("provider_post_id"),
  providerPostUrl: text("provider_post_url"),
  errorMessage: text("error_message"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const videoFolders = sqliteTable("video_folders", {
  id: text("id").primaryKey(),
  path: text("path").notNull(),
  label: text("label"),
  createdAt: text("created_at").notNull(),
});

export const jobLogs = sqliteTable("job_logs", {
  id: text("id").primaryKey(),
  jobId: text("job_id").notNull(),
  level: text("level").notNull(),
  message: text("message").notNull(),
  createdAt: text("created_at").notNull(),
});

export const groups = sqliteTable("combos", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
});

export const comboAccounts = sqliteTable("combo_accounts", {
  id: text("id").primaryKey(),
  comboId: text("combo_id").notNull(),
  accountId: text("account_id").notNull(),
  createdAt: text("created_at").notNull(),
});

export const publishDestinations = sqliteTable("publish_destinations", {
  id: text("id").primaryKey(),
  socialAccountId: text("social_account_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // youtube_channel | facebook_page | tiktok_account | instagram_account
  externalId: text("external_id"),
  createdAt: text("created_at").notNull(),
});

export const groupDestinations = sqliteTable("combo_destinations", {
  id: text("id").primaryKey(),
  groupId: text("combo_id").notNull(),
  destinationId: text("destination_id").notNull(),
  createdAt: text("created_at").notNull(),
});
