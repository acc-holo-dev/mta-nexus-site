import { readFileSync, statSync } from "node:fs";
try {
  const path = "/tmp/nexus-license-worker-health.json";
  if (statSync(path).size > 4096) throw new Error("Invalid heartbeat");
  const value = JSON.parse(readFileSync(path, "utf8")),
    now = Date.now();
  const heartbeat = Date.parse(value.heartbeatAt),
    progress = Date.parse(value.lastProgressAt);
  if (
    value.status !== "ready" ||
    !Number.isFinite(heartbeat) ||
    !Number.isFinite(progress) ||
    !Number.isSafeInteger(value.limit) ||
    value.limit < 1 ||
    value.limit > 100 ||
    !Number.isSafeInteger(value.intervalMs) ||
    value.intervalMs < 1000 ||
    value.intervalMs > 60000 ||
    heartbeat > now + 15000 ||
    heartbeat < now - 60000 ||
    progress > now + 15000 ||
    progress < now - (value.intervalMs + value.limit * 10000 + 30000)
  )
    throw new Error("Stale worker");
  process.stdout.write("License worker ready\n");
} catch {
  process.stderr.write("License worker is not ready\n");
  process.exitCode = 1;
}
