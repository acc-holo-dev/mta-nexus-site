import { readFile } from "node:fs/promises";

const HEALTH_FILE = "/tmp/nexus-account-mail-worker-health.json";

try {
  const raw = await readFile(HEALTH_FILE, "utf8");
  const data = JSON.parse(raw);
  const heartbeatAt = Date.parse(data?.heartbeatAt);
  const staleAfterMs = Number(data?.staleAfterMs);
  const pid = Number(data?.pid);

  if (data?.status !== "ready"
    || !Number.isFinite(heartbeatAt)
    || !Number.isInteger(staleAfterMs)
    || staleAfterMs < 30_000
    || staleAfterMs > 120_000
    || !Number.isInteger(pid)
    || pid < 1
    || Date.now() - heartbeatAt > staleAfterMs) {
    process.exitCode = 1;
  }
} catch {
  process.exitCode = 1;
}
