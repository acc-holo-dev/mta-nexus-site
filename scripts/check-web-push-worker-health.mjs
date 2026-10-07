import { readFile } from "node:fs/promises";

const HEALTH_FILE =
  "/tmp/nexus-web-push-worker-health.json";

try {
  const raw = await readFile(HEALTH_FILE, "utf8");
  const data = JSON.parse(raw);

  const heartbeatAt = Date.parse(data?.heartbeatAt);
  const staleAfterMs = Number(data?.staleAfterMs);
  const pid = Number(data?.pid);
  const configured = data?.configured;

  const queuePending = Number(data?.queuePending);
  const queueDue = Number(data?.queueDue);
  const queueLeased = Number(data?.queueLeased);
  const queueCapacity = Number(data?.queueCapacity);
  const queueOldestAgeSeconds = Number(
    data?.queueOldestAgeSeconds,
  );

  const queueStateValid = [
    queuePending,
    queueDue,
    queueLeased,
    queueCapacity,
    queueOldestAgeSeconds,
  ].every(
    (value) => Number.isInteger(value) && value >= 0,
  ) &&
    queueCapacity >= 1 &&
    queueCapacity <= 50_000 &&
    queueDue <= queuePending &&
    queueLeased <= queuePending;

  if (
    data?.status !== "ready" ||
    typeof configured !== "boolean" ||
    !Number.isFinite(heartbeatAt) ||
    !Number.isSafeInteger(staleAfterMs) ||
    staleAfterMs < 30_000 ||
    staleAfterMs > 120_000 ||
    !Number.isSafeInteger(pid) ||
    pid < 1 ||
    !queueStateValid ||
    Date.now() - heartbeatAt > staleAfterMs
  ) {
    process.exitCode = 1;
  }
} catch {
  process.exitCode = 1;
}
