import { createHash, randomBytes } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { and, count, eq, gt, isNull, like, lt, lte, or, sql } from "drizzle-orm";
import {
  db,
  notificationRepository,
  sessionRepository,
  userRepository,
  users,
  webPushOutbox,
  webPushOutboxRepository,
  webPushSubscriptionRepository,
  webPushWorkerRepository,
} from "../src/index";
import { WebPushDispatcher } from "../src/repositories/web-push-dispatcher";
import { evaluateWebPushSoak, readWebPushSoakConfig } from "../src/repositories/web-push-soak";
import type { WebPushDispatchSummary } from "../src/repositories/web-push-dispatcher";
import type { WebPushNotificationPayload, WebPushSender } from "../src/web-push-runtime";

if (process.env.NEXUS_WEB_PUSH_SOAK_ACK !== "YES") {
  throw new Error("Refusing Web Push soak without NEXUS_WEB_PUSH_SOAK_ACK=YES");
}

const config = readWebPushSoakConfig(process.env);
const suffix = randomBytes(8).toString("hex");
const userId = `usr_push_soak_long_${suffix}`;
const sessionId = `ses_push_soak_long_${suffix}`;
const notificationPrefix = `not_push_soak_long_${suffix}_`;
const here = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(here, "../../..");
const evidencePath = resolve(
  repositoryRoot,
  process.env.NEXUS_WEB_PUSH_SOAK_EVIDENCE_PATH?.trim() || "artifacts/web-push-soak-evidence.json",
);

const sleep = (ms: number) =>
  new Promise<void>((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });

const summary = {
  accepted: 0,
  retried: 0,
  discarded: 0,
  stale: 0,
  skipped: 0,
  unsettled: 0,
  cleaned: 0,
};

function addSummary(next: WebPushDispatchSummary) {
  summary.accepted += next.accepted;
  summary.retried += next.retried;
  summary.discarded += next.discarded;
  summary.stale += next.stale;
  summary.skipped += next.skipped;
  summary.unsettled += next.unsettled;
  summary.cleaned += next.cleaned;
}

async function fixturePending(): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(webPushOutbox)
    .where(like(webPushOutbox.notificationId, `${notificationPrefix}%`));
  return row.total;
}

const fixtureWorker = {
  async candidates(limit = 20) {
    const rows = await db
      .select({ id: webPushOutbox.id })
      .from(webPushOutbox)
      .where(
        and(
          like(webPushOutbox.notificationId, `${notificationPrefix}%`),
          lte(webPushOutbox.availableAt, sql`clock_timestamp()`),
          or(
            isNull(webPushOutbox.leaseExpiresAt),
            lte(webPushOutbox.leaseExpiresAt, sql`clock_timestamp()`),
          ),
          gt(webPushOutbox.expiresAt, sql`clock_timestamp()`),
          lt(webPushOutbox.attempts, 5),
        ),
      )
      .orderBy(webPushOutbox.availableAt, webPushOutbox.id)
      .limit(limit);
    return rows.map((row) => row.id);
  },
  claim: webPushWorkerRepository.claim.bind(webPushWorkerRepository),
  prepare: webPushWorkerRepository.prepare.bind(webPushWorkerRepository),
  settle: webPushWorkerRepository.settle.bind(webPushWorkerRepository),
  discardStaleSubscription:
    webPushWorkerRepository.discardStaleSubscription.bind(webPushWorkerRepository),
  async discardUnavailable() {
    return 0;
  },
};

const sendAttempts = new Map<string, number>();
const acceptedKeys = new Set<string>();
let duplicateAccepts = 0;
let forcedRetries = 0;
let senderCalls = 0;

const sender: WebPushSender = async (subscription, payload: WebPushNotificationPayload) => {
  senderCalls += 1;
  const key = `${subscription.endpoint}\0${payload.tag ?? ""}`;
  const attempt = (sendAttempts.get(key) ?? 0) + 1;
  sendAttempts.set(key, attempt);

  const digest = createHash("sha256").update(key).digest();
  const shouldRetry = digest.readUInt32BE(0) % config.retryEvery === 0;
  if (shouldRetry && attempt === 1) {
    forcedRetries += 1;
    return {
      statusCode: 503,
      retryAfterMs: 1_000,
    };
  }

  if (acceptedKeys.has(key)) duplicateAccepts += 1;
  acceptedKeys.add(key);
  return { statusCode: 201 };
};

const dispatchers = Array.from(
  { length: config.workers },
  () =>
    new WebPushDispatcher({
      sender,
      worker: fixtureWorker,
    }),
);

let notificationIndex = 0;
let enqueuedNotifications = 0;
let enqueuedJobs = 0;
let maxFixturePending = 0;
let maxGlobalPending = 0;
let maxGlobalDue = 0;
let maxGlobalLeased = 0;
let maxOldestAgeSeconds = 0;
let waves = 0;
let startedAt = 0;
let stoppedEnqueueAt = 0;
let completedAt = 0;
let fixtureCreated = false;
let cleanupSucceeded = true;
let evidenceCore: Record<string, unknown> | null = null;

async function snapshot() {
  const [fixture, global] = await Promise.all([fixturePending(), webPushOutboxRepository.stats()]);
  maxFixturePending = Math.max(maxFixturePending, fixture);
  maxGlobalPending = Math.max(maxGlobalPending, global.pending);
  maxGlobalDue = Math.max(maxGlobalDue, global.due);
  maxGlobalLeased = Math.max(maxGlobalLeased, global.leased);
  maxOldestAgeSeconds = Math.max(maxOldestAgeSeconds, global.oldestAgeSeconds);
  return { fixture, global };
}

async function enqueueWave() {
  const stats = await webPushOutboxRepository.stats();
  const waveJobs = config.notificationsPerWave * config.subscriptions;
  const headroom = stats.capacity - stats.pending;
  if (headroom < waveJobs * 2) {
    throw new Error(`Insufficient Web Push queue headroom for soak wave: ${headroom}`);
  }

  for (let index = 0; index < config.notificationsPerWave; index += 1) {
    const id = `${notificationPrefix}${notificationIndex++}`;
    const created = await notificationRepository.createWithPushOutbox({
      id,
      recipientId: userId,
      title: "Web Push production-duration soak",
      message: `Wave ${waves} notification ${index}`,
      link: "/notifications",
      type: "system",
      category: "system",
    });
    if (!created.notification) {
      throw new Error("Soak notification was unexpectedly suppressed");
    }
    if (created.pushQueueState !== "queued") {
      throw new Error(`Soak outbox enqueue failed: ${created.pushQueueState}`);
    }
    enqueuedNotifications += 1;
    enqueuedJobs += created.pushJobs;
  }
  waves += 1;
}

async function runDispatchRound() {
  const results = await Promise.all(
    dispatchers.map((dispatcher) => dispatcher.runBatch(config.batchLimit)),
  );
  for (const result of results) addSummary(result);
}

async function writeEvidence(value: unknown) {
  await mkdir(dirname(evidencePath), { recursive: true });
  const temporary = `${evidencePath}.tmp-${process.pid}`;
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, evidencePath);
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined);
  }
}

try {
  const initial = await webPushOutboxRepository.stats();
  const minimumHeadroom = config.notificationsPerWave * config.subscriptions * 4;
  if (initial.capacity - initial.pending < minimumHeadroom) {
    throw new Error("Web Push queue does not have enough free capacity for soak");
  }

  await userRepository.create({
    id: userId,
    email: `push_soak_long_${suffix}@example.invalid`,
    username: `push_soak_long_${suffix}`,
    displayName: "Web Push Duration Soak",
    role: "user",
  });
  fixtureCreated = true;
  await sessionRepository.create({
    id: sessionId,
    userId,
    token: `push-soak-long-${suffix}`,
    expiresAt: new Date(Date.now() + config.durationMs + config.drainTimeoutMs + 60 * 60 * 1_000),
  });
  for (let index = 0; index < config.subscriptions; index += 1) {
    const stored = await webPushSubscriptionRepository.upsert({
      id: `wps_push_soak_long_${suffix}_${index}`,
      userId,
      sessionId,
      endpoint: `https://push-soak-${index}.example.invalid/${suffix}`,
      p256dh: `soak-p256dh-${suffix}-${index}`,
      auth: `soak-auth-${suffix}-${index}`,
      expirationAt: null,
      userAgent: "nexus-web-push-soak",
    });
    if (!stored) {
      throw new Error("Failed to create soak subscription");
    }
  }

  startedAt = Date.now();
  let nextWaveAt = startedAt;
  while (Date.now() - startedAt < config.durationMs) {
    const now = Date.now();
    if (now >= nextWaveAt) {
      await enqueueWave();
      nextWaveAt += config.waveIntervalMs;
    }
    await runDispatchRound();
    await snapshot();
    await sleep(config.pollMs);
  }
  stoppedEnqueueAt = Date.now();

  const drainDeadline = stoppedEnqueueAt + config.drainTimeoutMs;
  while ((await fixturePending()) > 0 && Date.now() < drainDeadline) {
    await runDispatchRound();
    await snapshot();
    await sleep(config.pollMs);
  }
  completedAt = Date.now();

  const finalFixturePending = await fixturePending();
  const finalGlobal = await webPushOutboxRepository.stats();
  const verdict = evaluateWebPushSoak({
    durationTargetMs: config.durationMs,
    durationActualMs: stoppedEnqueueAt - startedAt,
    enqueuedJobs,
    acceptedUnique: acceptedKeys.size,
    duplicateAccepts,
    finalFixturePending,
    unsettled: summary.unsettled,
    discarded: summary.discarded,
    stale: summary.stale,
    forcedRetries,
    retried: summary.retried,
    maxFixturePending,
    queueCapacity: finalGlobal.capacity,
  });

  evidenceCore = {
    schemaVersion: 1,
    kind: "web_push_production_duration_soak",
    generatedAt: new Date().toISOString(),
    fixture: {
      namespace: suffix,
      notifications: enqueuedNotifications,
      subscriptions: config.subscriptions,
      jobs: enqueuedJobs,
      waves,
    },
    configuration: config,
    timing: {
      durationTargetMs: config.durationMs,
      durationActualMs: stoppedEnqueueAt - startedAt,
      drainMs: completedAt - stoppedEnqueueAt,
    },
    delivery: {
      senderCalls,
      forcedRetries,
      acceptedUnique: acceptedKeys.size,
      duplicateAccepts,
      dispatcher: summary,
    },
    queue: {
      maxFixturePending,
      maxGlobalPending,
      maxGlobalDue,
      maxGlobalLeased,
      maxOldestAgeSeconds,
      finalFixturePending,
      finalGlobalPending: finalGlobal.pending,
      capacity: finalGlobal.capacity,
    },
    verdict,
    runtime: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    },
  };
} finally {
  if (fixtureCreated) {
    try {
      const removed = await db
        .delete(users)
        .where(eq(users.id, userId))
        .returning({ id: users.id });
      cleanupSucceeded = removed.length === 1;
    } catch {
      cleanupSucceeded = false;
    }
  }

  if (evidenceCore) {
    const currentVerdict = evidenceCore.verdict as {
      passed: boolean;
      failures: readonly string[];
    };
    const finalVerdict = cleanupSucceeded
      ? currentVerdict
      : {
          passed: false,
          failures: [...currentVerdict.failures, "fixture_cleanup_failed"],
        };
    const finalCore = {
      ...evidenceCore,
      cleanup: {
        attempted: fixtureCreated,
        succeeded: cleanupSucceeded,
      },
      verdict: finalVerdict,
    };
    const evidenceSha256 = createHash("sha256").update(JSON.stringify(finalCore)).digest("hex");
    await writeEvidence({
      ...finalCore,
      evidenceSha256,
    });

    process.stdout.write(
      `web-push-soak status=${finalVerdict.passed ? "passed" : "failed"} jobs=${enqueuedJobs} accepted=${acceptedKeys.size} retries=${summary.retried} evidence=${evidencePath}\n`,
    );
    if (!finalVerdict.passed) process.exitCode = 1;
  }

  if (!cleanupSucceeded) {
    process.stderr.write(`web-push-soak cleanup failed for fixture namespace ${suffix}\n`);
    process.exitCode = 1;
  }
}
