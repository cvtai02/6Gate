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
