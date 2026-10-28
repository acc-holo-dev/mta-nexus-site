import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";

import {
  db,
  builds,
  moderationCases,
  products,
  reports,
  servers,
  sessions,
  users,
} from "../src/client";

export type ScenarioId =
  | "expired-session"
  | "private-server-owner"
  | "moderation-queue"
  | "resource-scan-pending";

export type ScenarioResult = Readonly<{
  scenario: ScenarioId;
  action: "applied" | "cleaned";
  created?: readonly string[];
  session?: Readonly<{
    userId: string;
    username: string;
    cookieName: "nexus_session";
    token: string;
    expiresAt: string;
  }>;
  notes?: readonly string[];
}>;

type ScenarioTransaction = Pick<typeof db, "delete" | "insert">;

const ids = {
  expiredSession: {
    user: "scn_usr_expired_session",
    session: "scn_ses_expired_session",
  },
  privateServerOwner: {
    user: "scn_usr_private_owner",
    session: "scn_ses_private_owner",
    server: "scn_srv_private_owner",
  },
  moderationQueue: {
    reporter: "scn_usr_reporter",
    moderator: "scn_usr_moderator",
    reporterSession: "scn_ses_reporter",
    moderatorSession: "scn_ses_moderator",
    server: "scn_srv_report_target",
    report: "scn_rpt_pending",
    moderationCase: "scn_mod_pending",
  },
  resourceScanPending: {
    developer: "scn_usr_resource_dev",
    session: "scn_ses_resource_dev",
    product: "scn_prd_scan_pending",
    build: "scn_bld_scan_pending",
  },
} as const;

function token() {
  return randomBytes(32).toString("base64url");
}

function activeExpiry() {
  return new Date(Date.now() + 2 * 60 * 60 * 1000);
}

function expiredAt() {
  return new Date(Date.now() - 60 * 60 * 1000);
}

async function cleanupExpiredSession(tx: ScenarioTransaction) {
  await tx.delete(sessions).where(eq(sessions.id, ids.expiredSession.session));
  await tx.delete(users).where(eq(users.id, ids.expiredSession.user));
}

async function cleanupPrivateServerOwner(tx: ScenarioTransaction) {
  await tx.delete(servers).where(eq(servers.id, ids.privateServerOwner.server));
  await tx.delete(sessions).where(eq(sessions.id, ids.privateServerOwner.session));
  await tx.delete(users).where(eq(users.id, ids.privateServerOwner.user));
}

async function cleanupModerationQueue(tx: ScenarioTransaction) {
  await tx
    .delete(moderationCases)
    .where(eq(moderationCases.id, ids.moderationQueue.moderationCase));
  await tx.delete(reports).where(eq(reports.id, ids.moderationQueue.report));
  await tx.delete(servers).where(eq(servers.id, ids.moderationQueue.server));
  await tx.delete(sessions).where(eq(sessions.id, ids.moderationQueue.reporterSession));
  await tx.delete(sessions).where(eq(sessions.id, ids.moderationQueue.moderatorSession));
  await tx.delete(users).where(eq(users.id, ids.moderationQueue.reporter));
  await tx.delete(users).where(eq(users.id, ids.moderationQueue.moderator));
}

async function cleanupResourceScanPending(tx: ScenarioTransaction) {
  await tx.delete(builds).where(eq(builds.id, ids.resourceScanPending.build));
  await tx.delete(products).where(eq(products.id, ids.resourceScanPending.product));
  await tx.delete(sessions).where(eq(sessions.id, ids.resourceScanPending.session));
  await tx.delete(users).where(eq(users.id, ids.resourceScanPending.developer));
}

const cleanupByScenario: Record<ScenarioId, (tx: ScenarioTransaction) => Promise<void>> = {
  "expired-session": cleanupExpiredSession,
  "private-server-owner": cleanupPrivateServerOwner,
  "moderation-queue": cleanupModerationQueue,
  "resource-scan-pending": cleanupResourceScanPending,
};

async function applyExpiredSession(): Promise<ScenarioResult> {
  const sessionToken = token();
  const expiresAt = expiredAt();

  await db.transaction(async (tx) => {
    await cleanupExpiredSession(tx);
    await tx.insert(users).values({
      id: ids.expiredSession.user,
      email: "expired-session@scenario.invalid",
      username: "scenario_expired",
      displayName: "Scenario Expired Session",
      role: "user",
      isVerified: false,
      emailVerified: false,
    });
    await tx.insert(sessions).values({
      id: ids.expiredSession.session,
      userId: ids.expiredSession.user,
      token: sessionToken,
      expiresAt,
      ipAddress: "192.0.2.10",
      userAgent: "MTA-NEXUS-Scenario-Lab",
    });
  });

  return {
    scenario: "expired-session",
    action: "applied",
    created: [ids.expiredSession.user, ids.expiredSession.session],
    session: {
      userId: ids.expiredSession.user,
      username: "scenario_expired",
      cookieName: "nexus_session",
      token: sessionToken,
      expiresAt: expiresAt.toISOString(),
    },
    notes: [
      "The token is intentionally expired and should be rejected by authenticated routes.",
      "The token exists only in the local development database and this command output.",
    ],
  };
}

async function applyPrivateServerOwner(): Promise<ScenarioResult> {
  const sessionToken = token();
  const expiresAt = activeExpiry();

  await db.transaction(async (tx) => {
    await cleanupPrivateServerOwner(tx);
    await tx.insert(users).values({
      id: ids.privateServerOwner.user,
      email: "private-owner@scenario.invalid",
      username: "scenario_owner",
      displayName: "Scenario Server Owner",
      role: "server_owner",
      isVerified: true,
      emailVerified: false,
    });
    await tx.insert(sessions).values({
      id: ids.privateServerOwner.session,
      userId: ids.privateServerOwner.user,
      token: sessionToken,
      expiresAt,
      ipAddress: "192.0.2.20",
      userAgent: "MTA-NEXUS-Scenario-Lab",
    });
    await tx.insert(servers).values({
      id: ids.privateServerOwner.server,
      name: "Scenario Private Server",
      slug: "scenario-private-server",
      description: "Synthetic private server created only by Scenario Lab.",
      ipAddress: "192.0.2.21",
      port: 22003,
      gameMode: "Scenario",
      mapName: "Synthetic",
      maxPlayers: 64,
      currentPlayers: 7,
      ownerId: ids.privateServerOwner.user,
      status: "active",
      visibility: "private",
      isVerified: false,
      lastObservedAt: new Date(),
      observationSource: "scenario-lab",
    });
  });

  return {
    scenario: "private-server-owner",
    action: "applied",
    created: [
      ids.privateServerOwner.user,
      ids.privateServerOwner.session,
      ids.privateServerOwner.server,
    ],
    session: {
      userId: ids.privateServerOwner.user,
      username: "scenario_owner",
      cookieName: "nexus_session",
      token: sessionToken,
      expiresAt: expiresAt.toISOString(),
    },
    notes: [
      "Use the returned local session token to inspect owner-scoped workspace screens.",
      "No password credential is created.",
    ],
  };
}

async function applyModerationQueue(): Promise<ScenarioResult> {
  const moderatorToken = token();
  const reporterToken = token();
  const expiresAt = activeExpiry();

  await db.transaction(async (tx) => {
    await cleanupModerationQueue(tx);
    await tx.insert(users).values([
      {
        id: ids.moderationQueue.reporter,
        email: "reporter@scenario.invalid",
        username: "scenario_reporter",
        displayName: "Scenario Reporter",
        role: "user",
        isVerified: false,
        emailVerified: false,
      },
      {
        id: ids.moderationQueue.moderator,
        email: "moderator@scenario.invalid",
        username: "scenario_moderator",
        displayName: "Scenario Moderator",
        role: "moderator",
        isVerified: true,
        emailVerified: false,
      },
    ]);
    await tx.insert(sessions).values([
      {
        id: ids.moderationQueue.reporterSession,
        userId: ids.moderationQueue.reporter,
        token: reporterToken,
        expiresAt,
        ipAddress: "192.0.2.30",
        userAgent: "MTA-NEXUS-Scenario-Lab",
      },
      {
        id: ids.moderationQueue.moderatorSession,
        userId: ids.moderationQueue.moderator,
        token: moderatorToken,
        expiresAt,
        ipAddress: "192.0.2.31",
        userAgent: "MTA-NEXUS-Scenario-Lab",
      },
    ]);
    await tx.insert(servers).values({
      id: ids.moderationQueue.server,
      name: "Scenario Report Target",
      slug: "scenario-report-target",
      description: "Synthetic public server used for moderation workflow checks.",
      ipAddress: "192.0.2.32",
      port: 22003,
      maxPlayers: 128,
      currentPlayers: 42,
      status: "active",
      visibility: "public",
      isVerified: false,
      lastObservedAt: new Date(),
      observationSource: "scenario-lab",
    });
    await tx.insert(reports).values({
      id: ids.moderationQueue.report,
      reporterId: ids.moderationQueue.reporter,
      targetType: "server",
      targetId: ids.moderationQueue.server,
      type: "misleading_metadata",
      reason: "Synthetic open report for Scenario Lab moderation checks.",
      evidenceUrls: [],
      status: "open",
    });
    await tx.insert(moderationCases).values({
      id: ids.moderationQueue.moderationCase,
      reportId: ids.moderationQueue.report,
      targetType: "server",
      targetId: ids.moderationQueue.server,
      status: "pending_review",
      moderatorId: ids.moderationQueue.moderator,
      reason: "Synthetic pending moderation case created by Scenario Lab.",
    });
  });

  return {
    scenario: "moderation-queue",
    action: "applied",
    created: [
      ids.moderationQueue.reporter,
      ids.moderationQueue.moderator,
      ids.moderationQueue.reporterSession,
      ids.moderationQueue.moderatorSession,
      ids.moderationQueue.server,
      ids.moderationQueue.report,
      ids.moderationQueue.moderationCase,
    ],
    session: {
      userId: ids.moderationQueue.moderator,
      username: "scenario_moderator",
      cookieName: "nexus_session",
      token: moderatorToken,
      expiresAt: expiresAt.toISOString(),
    },
    notes: [
      "The primary returned session belongs to the moderator.",
      "A separate reporter session is created in the database but is not printed.",
      "No real report, server, user or external evidence URL is used.",
    ],
  };
}

async function applyResourceScanPending(): Promise<ScenarioResult> {
  const sessionToken = token();
  const expiresAt = activeExpiry();

  await db.transaction(async (tx) => {
    await cleanupResourceScanPending(tx);
    await tx.insert(users).values({
      id: ids.resourceScanPending.developer,
      email: "resource-dev@scenario.invalid",
      username: "scenario_resource_dev",
      displayName: "Scenario Resource Developer",
      role: "developer",
      isVerified: true,
      emailVerified: false,
    });
    await tx.insert(sessions).values({
      id: ids.resourceScanPending.session,
      userId: ids.resourceScanPending.developer,
      token: sessionToken,
      expiresAt,
      ipAddress: "192.0.2.40",
      userAgent: "MTA-NEXUS-Scenario-Lab",
    });
    await tx.insert(products).values({
      id: ids.resourceScanPending.product,
      title: "Scenario Pending Resource",
      slug: "scenario-pending-resource",
      description: "Synthetic resource used to exercise pre-publication scan states.",
      shortDescription: "Scenario Lab resource awaiting scanner verdict.",
      type: "script",
      status: "pending_review",
      authorId: ids.resourceScanPending.developer,
      price: 0,
      currency: "USD",
      licenseModel: "unlimited",
      tags: ["scenario", "scanner"],
      currentVersion: "0.0.0-scenario",
      ratingAverage: 0,
      ratingCount: 0,
      salesCount: 0,
      isFeatured: false,
      compatibility: { mtaMinVersion: "1.6.0", dependencies: [] },
    });
    await tx.insert(builds).values({
      id: ids.resourceScanPending.build,
      productId: ids.resourceScanPending.product,
      version: "0.0.0-scenario",
      releaseNotes: "Synthetic build; no file is published.",
      status: "testing",
      storageKey: "scenario-lab/not-a-real-download.zip",
      sha256Hash: "0000000000000000000000000000000000000000000000000000000000000000",
      fileSizeBytes: 0,
      fileName: "scenario-resource.zip",
      mimeType: "application/zip",
      scanStatus: "not_scanned",
      scanner: null,
      scannedAt: null,
      mtaVersionTarget: "1.6.0",
      isSigned: false,
    });
  });

  return {
    scenario: "resource-scan-pending",
    action: "applied",
    created: [
      ids.resourceScanPending.developer,
      ids.resourceScanPending.session,
      ids.resourceScanPending.product,
      ids.resourceScanPending.build,
    ],
    session: {
      userId: ids.resourceScanPending.developer,
      username: "scenario_resource_dev",
      cookieName: "nexus_session",
      token: sessionToken,
      expiresAt: expiresAt.toISOString(),
    },
    notes: [
      "The storage key is intentionally non-existent and must never be treated as a downloadable build.",
      "The build is testing/not_scanned and the product remains pending_review.",
    ],
  };
}

const applyByScenario: Record<ScenarioId, () => Promise<ScenarioResult>> = {
  "expired-session": applyExpiredSession,
  "private-server-owner": applyPrivateServerOwner,
  "moderation-queue": applyModerationQueue,
  "resource-scan-pending": applyResourceScanPending,
};

export async function applyScenario(scenario: ScenarioId): Promise<ScenarioResult> {
  return applyByScenario[scenario]();
}

export async function cleanupScenario(scenario: ScenarioId): Promise<ScenarioResult> {
  await db.transaction(async (tx) => {
    await cleanupByScenario[scenario](tx);
  });
  return { scenario, action: "cleaned" };
}
