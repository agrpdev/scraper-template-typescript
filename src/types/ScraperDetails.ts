export type ScraperDetails = {
  id: string;
  accountId: string;
  name: string;
  comment: string;
  enabled: boolean;
  customSettings: Record<string, any>;
};
