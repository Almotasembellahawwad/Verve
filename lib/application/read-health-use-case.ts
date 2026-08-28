import type { RuntimeConfigPort } from "../ports/runtime-config";

export function readHealthUseCase(config: RuntimeConfigPort) {
  const snapshot = config.snapshot();
  const ready = !snapshot.isManagedDeployment || snapshot.rateLimitConfigured;
  return {
    status: ready ? "ok" as const : "not-ready" as const,
    commit: snapshot.commitSha,
    environment: snapshot.environment,
    checks: {
      configuration: "ok" as const,
      distributedRateLimit: snapshot.rateLimitConfigured ? "ok" as const : snapshot.isManagedDeployment ? "missing" as const : "local-fallback" as const,
    },
  };
}
