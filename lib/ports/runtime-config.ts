export type RuntimeConfigSnapshot = {
  environment: string;
  commitSha: string;
  rateLimitConfigured: boolean;
  rateLimitFailClosed: boolean;
  isManagedDeployment: boolean;
};

export interface RuntimeConfigPort {
  snapshot(): RuntimeConfigSnapshot;
}
