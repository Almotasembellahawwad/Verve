import { performance } from "node:perf_hooks";

const baseUrl = (process.env.VERVE_LOAD_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const requestCount = Math.max(1, Math.min(2_000, Number(process.env.VERVE_LOAD_REQUESTS ?? 100)));
const concurrency = Math.max(1, Math.min(100, Number(process.env.VERVE_LOAD_CONCURRENCY ?? 10)));
const p95BudgetMs = Math.max(50, Number(process.env.VERVE_LOAD_P95_MS ?? 2_000));
const route = process.env.VERVE_LOAD_ROUTE === "admission" ? "admission" : "health";

const durations = [];
const statuses = new Map();
let cursor = 0;

async function worker() {
  while (cursor < requestCount) {
    cursor += 1;
    const started = performance.now();
    try {
      const response = route === "health"
        ? await fetch(`${baseUrl}/api/health`, { cache: "no-store" })
        : await fetch(`${baseUrl}/api/generate/stream`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          });
      durations.push(performance.now() - started);
      statuses.set(response.status, (statuses.get(response.status) ?? 0) + 1);
      await response.arrayBuffer();
    } catch {
      durations.push(performance.now() - started);
      statuses.set(0, (statuses.get(0) ?? 0) + 1);
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));
durations.sort((left, right) => left - right);
const percentile = (value) => durations[Math.min(durations.length - 1, Math.floor(durations.length * value))] ?? 0;
const expectedStatuses = route === "health" ? new Set([200]) : new Set([400, 429]);
const unexpected = [...statuses.entries()].filter(([status]) => !expectedStatuses.has(status)).reduce((sum, [, count]) => sum + count, 0);
const p95 = percentile(.95);

console.log(JSON.stringify({
  target: baseUrl,
  route,
  requests: requestCount,
  concurrency,
  statuses: Object.fromEntries(statuses),
  latencyMs: { p50: Math.round(percentile(.5)), p95: Math.round(p95), p99: Math.round(percentile(.99)) },
}, null, 2));

if (unexpected > 0 || p95 > p95BudgetMs) process.exitCode = 1;
