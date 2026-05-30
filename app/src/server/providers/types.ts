export type PublishVideoInput = {
  accountId: string;
  /** The publish_destination id — needed by Meta to look up the page token. */
  destinationId?: string;
  videoPath: string;
  title?: string;
  caption?: string;
  privacy?: "private" | "public" | "unlisted";
  scheduledAt?: string;
  /** Internal job id. When set, adapters MAY call appendLog(jobId, ...) for live progress. */
  jobId?: string;
  /** Video (default) or Reel. Currently only Meta/Facebook Page distinguishes these. */
  contentType?: "Video" | "Reel";
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
