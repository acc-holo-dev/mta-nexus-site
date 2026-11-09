import { NextRequest } from "next/server";
import { afterEach, beforeEach, vi } from "vitest";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "./browser-mutation-headers";

/** Shared mock state for license-control HTTP suites. */
export const licenseControlHttpState = {
  user: { id: "usr_a", role: "user" } as {
    id: string;
    role: "user" | "moderator" | "admin";
  } | null,
  allowed: true,
  verify: vi.fn(),
  verifyRelease: vi.fn(),
  historyPage: vi.fn(),
  releasePage: vi.fn(),
  archive: vi.fn(),
  preview: vi.fn(),
  ownerCommand: vi.fn(),
  moderate: vi.fn(),
  detail: vi.fn(),
  servers: vi.fn(),
};

/** Factory for `vi.mock("@nexus/db", …)` from suite files under `tests/`. */
export function createLicenseControlHttpDbMock() {
  return {
    licenseRepository: { pageUserHistory: licenseControlHttpState.archive },
    licenseMaintenanceRepository: { preview: licenseControlHttpState.preview },
    licenseControlsRepository: {
      verify: licenseControlHttpState.verify,
      verifyRelease: licenseControlHttpState.verifyRelease,
      historyPage: licenseControlHttpState.historyPage,
      releasePage: licenseControlHttpState.releasePage,
      ownerCommand: licenseControlHttpState.ownerCommand,
      moderate: licenseControlHttpState.moderate,
      detail: licenseControlHttpState.detail,
      eligibleServers: licenseControlHttpState.servers,
    },
  };
}

export const licenseControlHttpContext = { params: Promise.resolve({ id: "lic_a" }) };
export const revision = "2026-10-10T00:00:00.000Z";
export const updated = "2026-10-10T01:00:00.000Z";

export const releaseProbe = {
  serverId: "srv_a",
  productId: "prd_a",
  buildId: "bld_a",
  sha256Hash: "a".repeat(64),
  nonce: "cc98ca86-5a01-4b7f-b2ac-1eabbeff533f",
};

export function licenseControlHttpRequest(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return new NextRequest(`https://nexus.test${path}`, {
    method: "POST",
    headers: {
      ...browserMutationHeaders(),
      "content-type": "application/json",
      cookie: "nexus_session=initiating-session",
      "x-nexus-actor-id": "usr_a",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function resetLicenseControlHttpState() {
  licenseControlHttpState.user = { id: "usr_a", role: "user" };
  licenseControlHttpState.allowed = true;
  for (const mock of [
    licenseControlHttpState.verify,
    licenseControlHttpState.verifyRelease,
    licenseControlHttpState.historyPage,
    licenseControlHttpState.releasePage,
    licenseControlHttpState.archive,
    licenseControlHttpState.preview,
    licenseControlHttpState.ownerCommand,
    licenseControlHttpState.moderate,
    licenseControlHttpState.detail,
    licenseControlHttpState.servers,
  ])
    mock.mockReset();
}

/** Shared auth/rate-limit/env lifecycle for every license-control HTTP suite. */
export function installLicenseControlHttpLifecycle() {
  afterEach(() => {
    vi.unstubAllEnvs();
  });
  beforeEach(() => {
    stubBrowserMutationOrigin();
    resetLicenseControlHttpState();
  });
}
