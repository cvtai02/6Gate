export interface CreateDestinationDto {
  socialAccountId: string;
  name: string;
  type: string;
  externalId?: string | null;
}
