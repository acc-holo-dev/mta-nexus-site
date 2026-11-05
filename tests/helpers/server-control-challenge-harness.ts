import {
  db,
  serverRepository,
  sessionRepository,
  userRepository,
  verificationRequests,
} from "@nexus/db";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, vi } from "vitest";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "../browser-mutation-headers";
import {
  assignIntegrationStaffPassword,
  INTEGRATION_STAFF_PASSWORD,
} from "../integration-staff-password";

/** Mutable MTA directory snapshot returned by the suite-local `vi.mock` factory. */
export const directoryState = {
  current: {
    fetchedAt: "2026-09-25T12:00:00.000Z",
    isStale: false,
    servers: [] as Array<{
      address: string;
      port: number;
      name?: string;
      responding?: boolean;
    }>,
  },
};

function resetDirectoryState() {
  directoryState.current = {
    fetchedAt: "2026-09-25T12:00:00.000Z",
    isStale: false,
    servers: [],
  };
}

/** Register shared beforeEach/afterEach for server-control-challenge suites. */
export function setupServerControlChallenge() {
  beforeEach(() => {
    stubBrowserMutationOrigin();
    resetDirectoryState();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });
}

export function post(url: string, token: string, body?: Record<string, unknown>) {
  return new NextRequest(url, {
    method: "POST",
    headers: browserMutationHeaders({
      ...(body ? { "content-type": "application/json" } : {}),
      cookie: `nexus_session=${token}`,
      "x-nexus-actor-id": token.replace(/^tok_control_/, "usr_control_"),
    }),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

/** Claimant, attacker, moderator, and unowned public server for the live proof flow. */
export async function seedLiveControlChallenge() {
  const suffix = `${Date.now().toString(36)}_${process.pid}`;
  const userId = `usr_control_${suffix}`;
  const attackerId = `usr_control_attacker_${suffix}`;
  const moderatorId = `usr_control_moderator_${suffix}`;
  const sessionToken = `tok_control_${suffix}`;
  const attackerToken = `tok_control_attacker_${suffix}`;
  const moderatorToken = `tok_control_moderator_${suffix}`;
  const serverId = `srv_control_${suffix}`;
  const address = "198.51.100.211";
  const port = 18_000 + ((Date.now() + process.pid) % 30_000);

  await userRepository.create({
    id: userId,
    email: `server_control_${suffix}@nexus.test`,
    username: `server_control_${suffix}`,
    displayName: "Server Control Claimant",
    role: "user",
  });
  await sessionRepository.create({
    id: `ses_control_${suffix}`,
    userId,
    token: sessionToken,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  await userRepository.create({
    id: attackerId,
    email: `server_control_attacker_${suffix}@nexus.test`,
    username: `server_control_attacker_${suffix}`,
    displayName: "Server Control Attacker",
    role: "user",
  });
  await sessionRepository.create({
    id: `ses_control_attacker_${suffix}`,
    userId: attackerId,
    token: attackerToken,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  await userRepository.create({
    id: moderatorId,
    email: `server_control_moderator_${suffix}@nexus.test`,
    username: `server_control_moderator_${suffix}`,
    displayName: "Server Control Moderator",
    role: "moderator",
  });
  await sessionRepository.create({
    id: `ses_control_moderator_${suffix}`,
    userId: moderatorId,
    token: moderatorToken,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  await assignIntegrationStaffPassword(moderatorId);
  await serverRepository.create({
    id: serverId,
    name: "Control Challenge Server",
    slug: `control-challenge-${suffix}`,
    ipAddress: address,
    port,
    status: "active",
    visibility: "public",
    isVerified: false,
    gameplayTags: [],
    mediaUrls: [],
  });

  return {
    userId,
    moderatorId,
    sessionToken,
    attackerToken,
    moderatorToken,
    serverId,
    address,
    port,
    staffPassword: INTEGRATION_STAFF_PASSWORD,
  };
}

/** Pending server verification with no consumed control proof (legacy fail-closed path). */
export async function seedLegacyPendingClaim() {
  const suffix = `${Date.now().toString(36)}_${process.pid}`;
  const requesterId = `usr_legacy_claim_${suffix}`;
  const reviewerId = `usr_legacy_reviewer_${suffix}`;
  const serverId = `srv_legacy_claim_${suffix}`;
  const requestId = `ver_legacy_claim_${suffix}`;
  const port = 19_000 + ((Date.now() + process.pid) % 30_000);
  const reviewerToken = `tok_${reviewerId}`;

  await userRepository.create({
    id: requesterId,
    email: `legacy_claim_${suffix}@nexus.test`,
    username: `legacy_claim_${suffix}`,
    displayName: "Legacy Claim Requester",
    role: "user",
  });
  await userRepository.create({
    id: reviewerId,
    email: `legacy_reviewer_${suffix}@nexus.test`,
    username: `legacy_reviewer_${suffix}`,
    displayName: "Legacy Claim Reviewer",
    role: "moderator",
  });
  await sessionRepository.create({
    id: `ses_${reviewerId}`,
    userId: reviewerId,
    token: reviewerToken,
    expiresAt: new Date("2099-01-01T00:00:00.000Z"),
  });
  await serverRepository.create({
    id: serverId,
    name: "Legacy Pending Claim",
    slug: `legacy-pending-claim-${suffix}`,
    ipAddress: "198.51.100.212",
    port,
    status: "active",
    visibility: "public",
    isVerified: false,
    gameplayTags: [],
    mediaUrls: [],
  });
  await db.insert(verificationRequests).values({
    id: requestId,
    requesterId,
    targetType: "server",
    targetId: serverId,
    status: "pending",
    notes: "Legacy pre-challenge ownership request.",
    createdAt: new Date(),
  });

  return { requesterId, reviewerId, reviewerToken, serverId, requestId };
}
