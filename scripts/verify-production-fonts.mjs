import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const port = 4319;
const nextBin = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
const server = spawn(process.execPath, [nextBin, "start", "-p", String(port)], {
  cwd: fileURLToPath(new URL("..", import.meta.url)),
  env: { ...process.env, NODE_ENV: "production" },
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
server.stdout.on("data", (chunk) => { output += chunk.toString(); });
server.stderr.on("data", (chunk) => { output += chunk.toString(); });

const deadline = Date.now() + 25_000;
try {
  let response;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`next start exited early (${server.exitCode}).\n${output}`);
    try {
      response = await fetch(`http://127.0.0.1:${port}/api/health`, { cache: "no-store" });
      if (response.ok || response.status === 503) break;
    } catch {
      // The production server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!response) throw new Error(`Production health endpoint did not start.\n${output}`);
  const health = await response.json();
  if (health?.checks?.typographyAssets !== "ok") {
    throw new Error(`Production typography runtime is unavailable: ${JSON.stringify(health)}`);
  }
  console.log("Production typography runtime: ok");
} finally {
  server.kill();
}
