import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, vi } from "vitest";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "../browser-mutation-headers";

/** Shared after() queue for support HTTP route suites. */
export const supportRouteState = {
  afterCallbacks: [] as Array<() => unknown | Promise<unknown>>,
};

/** Shared repository/auth mocks for support HTTP route suites. */
export const supportRouteMocks = {
  session: vi.fn(),
  can: vi.fn(),
  rate: vi.fn(),
  pageByRequester: vi.fn(),
  pageStaff: vi.fn(),
  findById: vi.fn(),
  pageMessages: vi.fn(),
  authorizedThread: vi.fn(),
  createIdempotentCase: vi.fn(),
  addIdempotentMessage: vi.fn(),
  findMutationReplay: vi.fn(),
  updateStatus: vi.fn(),
  moderatorIds: vi.fn(),
  dispatch: vi.fn(),
};

export const supportRouteAfterMock = vi.fn((callback: () => unknown | Promise<unknown>) => {
  supportRouteState.afterCallbacks.push(callback);
});

export const supportCaseId = `sup_${"a".repeat(24)}`;
export const supportRouteParams = { params: Promise.resolve({ id: supportCaseId }) };

export const supportMutationHeaders = {
  cookie: "nexus_session=initiating-token",
  ...browserMutationHeaders(),
  "content-type": "application/json",
  "Idempotency-Key": "12345678-1234-4234-8234-123456789abc",
  "x-nexus-actor-id": "usr_member",
};

/** Factory for `vi.mock("@nexus/db", …)` from suite files under `tests/`. */
export function createSupportRouteDbMock() {
  return {
    supportCaseRepository: {
      pageByRequester: supportRouteMocks.pageByRequester,
      pageStaff: supportRouteMocks.pageStaff,
      findById: supportRouteMocks.findById,
      pageMessages: supportRouteMocks.pageMessages,
      authorizedThread: supportRouteMocks.authorizedThread,
      createIdempotentCase: supportRouteMocks.createIdempotentCase,
      addIdempotentMessage: supportRouteMocks.addIdempotentMessage,
      findMutationReplay: supportRouteMocks.findMutationReplay,
      updateStatus: supportRouteMocks.updateStatus,
    },
    userRepository: { listModeratorIds: supportRouteMocks.moderatorIds },
  };
}

/** Factory for `vi.mock("@nexus/security", …)` from suite files under `tests/`. */
export function createSupportRouteSecurityMock() {
  return {
    can: supportRouteMocks.can,
    consumeRateLimit: supportRouteMocks.rate,
    generateId: (prefix: string) => `${prefix}_${"a".repeat(24)}`,
  };
}

export function expectSupportPrivate(response: Response) {
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(response.headers.get("x-request-id")).toBeTruthy();
}

export function supportPrivateGet(url: string) {
  return new NextRequest(url, { headers: { cookie: "nexus_session=initiating-token" } });
}

function resetSupportRouteMocks() {
  stubBrowserMutationOrigin();
  vi.clearAllMocks();
  for (const mock of Object.values(supportRouteMocks)) mock.mockReset();
  supportRouteState.afterCallbacks.length = 0;
  supportRouteMocks.session.mockResolvedValue(null);
  supportRouteMocks.can.mockReturnValue(false);
  supportRouteMocks.rate.mockResolvedValue({ success: true });
  supportRouteMocks.pageByRequester.mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 1,
  });
  supportRouteMocks.pageStaff.mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 1,
  });
  supportRouteMocks.findById.mockResolvedValue(null);
  supportRouteMocks.pageMessages.mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 100,
    total: 0,
    totalPages: 1,
  });
  supportRouteMocks.findMutationReplay.mockResolvedValue({ kind: "missing" });
  supportRouteMocks.createIdempotentCase.mockResolvedValue({
    kind: "created",
    supportCase: {
      id: supportCaseId,
      requesterId: "usr_member",
      category: "account",
      subject: "Account help",
      status: "open",
    },
  });
  supportRouteMocks.addIdempotentMessage.mockResolvedValue({
    kind: "created",
    supportCase: { id: supportCaseId, status: "open" },
    message: { id: `spm_${"a".repeat(24)}`, authorRole: "requester" },
  });
  supportRouteMocks.updateStatus.mockResolvedValue({
    id: supportCaseId,
    requesterId: "usr_member",
    subject: "Account help",
    status: "resolved",
  });
  supportRouteMocks.moderatorIds.mockResolvedValue(["usr_mod"]);
  supportRouteMocks.dispatch.mockResolvedValue({
    requested: 1,
    stored: 1,
    storageFailed: 0,
    pushQueued: 1,
  });
}

/** Shared auth/rate-limit/env lifecycle for every support HTTP route suite. */
export function installSupportRouteLifecycle() {
  beforeEach(() => {
    resetSupportRouteMocks();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });
}
