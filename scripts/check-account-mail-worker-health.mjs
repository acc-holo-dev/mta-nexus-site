import { readFile } from "node:fs/promises";

const HEALTH_FILE = "/tmp/nexus-account-mail-worker-health.json";

try {
  const raw = await readFile(HEALTH_FILE, "utf8");
  const data = JSON.parse(raw);

  const heartbeatAt = Date.parse(data?.heartbeatAt);
  const staleAfterMs = Number(data?.staleAfterMs);
  const pid = Number(data?.pid);

  const providerBlocked = data?.providerBlocked;
  const providerFailureStreak = Number(data?.providerFailureStreak);
  const providerBlockedUntil = data?.providerBlockedUntil;
  const providerBlockedUntilAt = providerBlockedUntil === null
    ? null
    : Date.parse(providerBlockedUntil);

  const queuePending = Number(data?.queuePending);
  const queueDue = Number(data?.queueDue);
  const queueLeased = Number(data?.queueLeased);
  const queueCapacity = Number(data?.queueCapacity);
  const queueOldestAgeSeconds = Number(data?.queueOldestAgeSeconds);
  const queuePressure = data?.queuePressure;

  const providerStateValid = typeof providerBlocked === "boolean"
    && Number.isInteger(providerFailureStreak)
    && providerFailureStreak >= 0
    && providerFailureStreak <= 10
    && (
      (providerFailureStreak === 0 && providerBlockedUntil === null)
      || (providerFailureStreak > 0 && Number.isFinite(providerBlockedUntilAt))
    )
    && (!providerBlocked || providerFailureStreak > 0);

  const queueStateValid = [queuePending, queueDue, queueLeased, queueCapacity, queueOldestAgeSeconds]
    .every((value) => Number.isInteger(value) && value >= 0)
    && queueCapacity >= 1
    && queueCapacity <= 1000
    && queueDue <= queuePending
    && queueLeased <= queuePending
    && typeof queuePressure === "boolean"
    && queuePressure === (queuePending * 100 >= queueCapacity * 80);

  if (data?.status !== "ready"
    || !Number.isFinite(heartbeatAt)
    || !Number.isInteger(staleAfterMs)
    || staleAfterMs < 30_000
    || staleAfterMs > 120_000
    || !Number.isInteger(pid)
    || pid < 1
    || !providerStateValid
    || !queueStateValid
    || Date.now() - heartbeatAt > staleAfterMs) {
    process.exitCode = 1;
  }
} catch {
  process.exitCode = 1;
}
