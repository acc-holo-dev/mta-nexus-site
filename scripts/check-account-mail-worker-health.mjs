import { readFile } from "node:fs/promises";

const HEALTH_FILE =
  process.env.NEXUS_ACCOUNT_MAIL_HEALTH_FILE || "/tmp/nexus-account-mail-worker-health.json";

try {
  const raw = await readFile(HEALTH_FILE, "utf8");
  const data = JSON.parse(raw);
  const now = Date.now();

  const heartbeatAt = Date.parse(data?.heartbeatAt);
  const staleAfterMs = data?.staleAfterMs;
  const progressAt = Date.parse(data?.progressAt);
  const progressStaleAfterMs = data?.progressStaleAfterMs;
  const pid = data?.pid;

  const providerBlocked = data?.providerBlocked;
  const providerFailureStreak = data?.providerFailureStreak;
  const providerBlockedUntil = data?.providerBlockedUntil;
  const providerBlockedUntilAt =
    providerBlockedUntil === null ? null : Date.parse(providerBlockedUntil);

  const queuePending = data?.queuePending;
  const queueDue = data?.queueDue;
  const queueLeased = data?.queueLeased;
  const queueCapacity = data?.queueCapacity;
  const queueOldestAgeSeconds = data?.queueOldestAgeSeconds;
  const queuePressure = data?.queuePressure;

  const deliveryWindowMinutes = data?.deliveryWindowMinutes;
  const deliveryAccepted = data?.deliveryAccepted;
  const deliveryRetried = data?.deliveryRetried;
  const deliveryDiscarded = data?.deliveryDiscarded;
  const deliveryProviderDeferred = data?.deliveryProviderDeferred;
  const deliveryUncertain = data?.deliveryUncertain;

  const providerStateValid =
    typeof providerBlocked === "boolean" &&
    Number.isSafeInteger(providerFailureStreak) &&
    providerFailureStreak >= 0 &&
    providerFailureStreak <= 10 &&
    ((providerFailureStreak === 0 && providerBlockedUntil === null) ||
      (providerFailureStreak > 0 && Number.isFinite(providerBlockedUntilAt))) &&
    (!providerBlocked || providerFailureStreak > 0);

  const queueStateValid =
    [queuePending, queueDue, queueLeased, queueCapacity, queueOldestAgeSeconds].every(
      (value) => Number.isSafeInteger(value) && value >= 0,
    ) &&
    queueCapacity >= 1 &&
    queueCapacity <= 1000 &&
    queueDue <= queuePending &&
    queueLeased <= queuePending &&
    typeof queuePressure === "boolean" &&
    queuePressure === queuePending * 100 >= queueCapacity * 80;

  const deliveryStateValid =
    deliveryWindowMinutes === 30 &&
    [
      deliveryAccepted,
      deliveryRetried,
      deliveryDiscarded,
      deliveryProviderDeferred,
      deliveryUncertain,
    ].every((value) => Number.isSafeInteger(value) && value >= 0);

  if (
    data?.status !== "ready" ||
    !Number.isFinite(heartbeatAt) ||
    heartbeatAt > now + 5_000 ||
    !Number.isInteger(staleAfterMs) ||
    staleAfterMs < 30_000 ||
    staleAfterMs > 120_000 ||
    !Number.isFinite(progressAt) ||
    progressAt > now + 5_000 ||
    !Number.isSafeInteger(progressStaleAfterMs) ||
    progressStaleAfterMs < 120_000 ||
    progressStaleAfterMs > 7_200_000 ||
    progressAt > heartbeatAt + 5_000 ||
    !Number.isInteger(pid) ||
    pid < 1 ||
    !providerStateValid ||
    !queueStateValid ||
    !deliveryStateValid ||
    now - heartbeatAt > staleAfterMs ||
    now - progressAt > progressStaleAfterMs
  ) {
    process.exitCode = 1;
  }
} catch {
  process.exitCode = 1;
}
