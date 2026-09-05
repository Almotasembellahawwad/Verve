import type { RuntimeConfigPort } from "../ports/runtime-config";

export function readHealthUseCase(
  config: RuntimeConfigPort,
  dependencies: { typographyAssets?: "ok" | "missing" } = {}
) {
  const snapshot = config.snapshot();
  const missingDistributedRateLimit = snapshot.isManagedDeployment && !snapshot.rateLimitConfigured;
  const typographyAssets = dependencies.typographyAssets ?? "ok";
  const unavailable = typographyAssets === "missing" || (missingDistributedRateLimit && snapshot.rateLimitFailClosed);
  const degraded = missingDistributedRateLimit && !snapshot.rateLimitFailClosed;
  return {
    status: unavailable ? "not-ready" as const : degraded ? "degraded" as const : "ok" as const,
    commit: snapshot.commitSha,
    environment: snapshot.environment,
    checks: {
      configuration: "ok" as const,
      typographyAssets,
      distributedRateLimit: snapshot.rateLimitConfigured
        ? "ok" as const
        : unavailable
          ? "missing" as const
          : "memory-fallback" as const,
    },
  };
}
