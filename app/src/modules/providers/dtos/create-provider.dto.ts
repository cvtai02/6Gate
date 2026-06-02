export interface CreateProviderDto {
  name: string;
  type: string;
  clientId?: string;
  clientSecret?: string;
  authUrl?: string;
  tokenUrl?: string;
  scopes?: string[];
}
