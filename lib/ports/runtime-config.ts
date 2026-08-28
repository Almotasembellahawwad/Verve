export type RuntimeConfigSnapshot = {
  environment: string;
  commitSha: string;
  rateLimitConfigured: boolean;
  isManagedDeployment: boolean;
};

export interface RuntimeConfigPort {
  snapshot(): RuntimeConfigSnapshot;
}
