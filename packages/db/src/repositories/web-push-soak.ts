export type WebPushSoakConfig = Readonly<{
  durationMs: number;
  workers: number;
  subscriptions: number;
  notificationsPerWave: number;
  waveIntervalMs: number;
  pollMs: number;
  drainTimeoutMs: number;
  batchLimit: number;
  retryEvery: number;
}>;

const limits = {
  durationMs: [60_000, 6 * 60 * 60 * 1_000],
  workers: [1, 8],
  subscriptions: [1, 8],
  notificationsPerWave: [1, 32],
  waveIntervalMs: [500, 60_000],
  pollMs: [25, 5_000],
  drainTimeoutMs: [10_000, 10 * 60 * 1_000],
  batchLimit: [1, 100],
  retryEvery: [2, 100],
} as const;

function integer(
  env: Record<string, string | undefined>,
  key: string,
  fallback: number,
  [minimum, maximum]: readonly [number, number],
): number {
  const raw = env[key]?.trim();
  const value = raw ? Number(raw) : fallback;
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${key} must be an integer between ${minimum} and ${maximum}`);
  }
  return value;
}

export function readWebPushSoakConfig(env: Record<string, string | undefined>): WebPushSoakConfig {
  return Object.freeze({
    durationMs: integer(env, "NEXUS_WEB_PUSH_SOAK_DURATION_MS", 15 * 60 * 1_000, limits.durationMs),
    workers: integer(env, "NEXUS_WEB_PUSH_SOAK_WORKERS", 4, limits.workers),
    subscriptions: integer(env, "NEXUS_WEB_PUSH_SOAK_SUBSCRIPTIONS", 4, limits.subscriptions),
    notificationsPerWave: integer(
      env,
      "NEXUS_WEB_PUSH_SOAK_NOTIFICATIONS_PER_WAVE",
      8,
      limits.notificationsPerWave,
    ),
    waveIntervalMs: integer(
      env,
      "NEXUS_WEB_PUSH_SOAK_WAVE_INTERVAL_MS",
      5_000,
      limits.waveIntervalMs,
    ),
    pollMs: integer(env, "NEXUS_WEB_PUSH_SOAK_POLL_MS", 100, limits.pollMs),
    drainTimeoutMs: integer(
      env,
      "NEXUS_WEB_PUSH_SOAK_DRAIN_TIMEOUT_MS",
      2 * 60 * 1_000,
      limits.drainTimeoutMs,
    ),
    batchLimit: integer(env, "NEXUS_WEB_PUSH_SOAK_BATCH_LIMIT", 100, limits.batchLimit),
    retryEvery: integer(env, "NEXUS_WEB_PUSH_SOAK_RETRY_EVERY", 10, limits.retryEvery),
  });
}

export type WebPushSoakVerdictInput = Readonly<{
  durationTargetMs: number;
  durationActualMs: number;
  enqueuedJobs: number;
  acceptedUnique: number;
  duplicateAccepts: number;
  finalFixturePending: number;
  unsettled: number;
  discarded: number;
  stale: number;
  forcedRetries: number;
  retried: number;
  maxFixturePending: number;
  queueCapacity: number;
}>;

export type WebPushSoakVerdict = Readonly<{
  passed: boolean;
  failures: readonly string[];
}>;

export function evaluateWebPushSoak(input: WebPushSoakVerdictInput): WebPushSoakVerdict {
  const failures: string[] = [];
  if (input.durationActualMs < input.durationTargetMs) {
    failures.push("duration_shortfall");
  }
  if (input.enqueuedJobs < 1) {
    failures.push("no_jobs_enqueued");
  }
  if (input.acceptedUnique !== input.enqueuedJobs) {
    failures.push("not_all_jobs_accepted");
  }
  if (input.duplicateAccepts !== 0) {
    failures.push("duplicate_acceptance");
  }
  if (input.finalFixturePending !== 0) {
    failures.push("fixture_queue_not_drained");
  }
  if (input.unsettled !== 0) {
    failures.push("unsettled_leases");
  }
  if (input.discarded !== 0 || input.stale !== 0) {
    failures.push("unexpected_terminal_failures");
  }
  if (input.forcedRetries < 1 || input.retried < input.forcedRetries) {
    failures.push("retry_path_not_exercised");
  }
  if (input.queueCapacity < 1 || input.maxFixturePending > input.queueCapacity) {
    failures.push("queue_capacity_violation");
  }
  return Object.freeze({
    passed: failures.length === 0,
    failures: Object.freeze(failures),
  });
}
