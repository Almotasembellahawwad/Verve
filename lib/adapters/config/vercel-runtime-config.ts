import type { RuntimeConfigPort, RuntimeConfigSnapshot } from "../../ports/runtime-config";

export class VercelRuntimeConfigAdapter implements RuntimeConfigPort {
  snapshot(): RuntimeConfigSnapshot {
    return {
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
      commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
      rateLimitConfigured: Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
      rateLimitFailClosed: process.env.RATE_LIMIT_FAIL_CLOSED === "true",
      isManagedDeployment: Boolean(process.env.VERCEL_ENV),
    };
  }
}
