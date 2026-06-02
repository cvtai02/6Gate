export interface OauthCallbackDto {
  providerId: string;
  code: string;
  state?: string;
}
