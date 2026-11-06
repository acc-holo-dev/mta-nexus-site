import { NextRequest } from "next/server";
import { afterEach, beforeEach, vi } from "vitest";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "../browser-mutation-headers";

/** Shared mutable fixtures for commercial-operations HTTP suite splits. */
export const commercialOperationsHttpState = {
  user: { id: "usr_a", role: "admin" } as null | {
    id: string;
    role: "admin" | "moderator" | "user";
  },
  allowed: true,
  catalog: vi.fn(),
  published: vi.fn(),
  adminPage: vi.fn(),
  adminDetail: vi.fn(),
  command: vi.fn(),
  detail: vi.fn(),
  cancel: vi.fn(),
};

/** Rate limit mock replaces only `consumeRateLimit` while spreading the real module. */
export const commercialOperationsHttpConsumeRateLimit = vi.fn(async () => ({
  success: commercialOperationsHttpState.allowed,
}));

/** Factory for `vi.mock("../apps/web/src/lib/services/auth-service", …)`. */
export function createCommercialOperationsHttpAuthMock() {
  return {
    authService: { getSession: async () => commercialOperationsHttpState.user },
  };
}

/** Factory for `vi.mock("@nexus/db", …)`. */
export function createCommercialOperationsHttpDbMock() {
  return {
    commercialPlanRepository: {
      catalog: commercialOperationsHttpState.catalog,
      published: commercialOperationsHttpState.published,
      adminPage: commercialOperationsHttpState.adminPage,
      adminDetail: commercialOperationsHttpState.adminDetail,
      command: commercialOperationsHttpState.command,
    },
    orderOperationsRepository: {
      buyerDetail: commercialOperationsHttpState.detail,
      cancel: commercialOperationsHttpState.cancel,
    },
  };
}

/** Factory for `vi.mock("@nexus/security", async (importOriginal) => …)`. */
export async function createCommercialOperationsHttpSecurityMock(
  importOriginal: <T>() => Promise<T>,
) {
  return {
    ...(await importOriginal<typeof import("@nexus/security")>()),
    consumeRateLimit: commercialOperationsHttpConsumeRateLimit,
  };
}

export const commercialOperationsHttpCtx = { params: Promise.resolve({ id: "ord_a" }) };
export const commercialOperationsHttpPlanCtx = { params: Promise.resolve({ id: "cplan_a" }) };

export const commercialOperationsHttpTerms = {
  titleRu: "Тариф",
  titleEn: "Seller plan",
  descriptionRu: "Описание тарифа",
  descriptionEn: "Published plan terms",
  price: 999,
  currency: "USD",
  durationDays: 30,
  commissionBps: 750,
};

export const commercialOperationsHttpCancellation = {
  requestId: "123e4567-e89b-42d3-a456-426614174000",
  expectedUpdatedAt: "2026-10-10T12:00:00.000Z",
  reason: "No longer needed",
};

export function commercialOperationsHttpRequest(
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
) {
  return new NextRequest(
    `https://nexus.test${path}`,
    body === undefined
      ? undefined
      : {
          method: "POST",
          headers: {
            ...browserMutationHeaders(),
            cookie: "nexus_session=plan-admin-token",
            "x-nexus-actor-id": "usr_a",
            "content-type": "application/json",
            ...headers,
          },
          body: JSON.stringify(body),
        },
  );
}

function resetCommercialOperationsHttpState() {
  commercialOperationsHttpState.user = { id: "usr_a", role: "admin" };
  commercialOperationsHttpState.allowed = true;
  commercialOperationsHttpState.catalog.mockReset().mockResolvedValue({ plans: [] });
  commercialOperationsHttpState.published.mockReset().mockResolvedValue({
    ...commercialOperationsHttpTerms,
    id: "cplan_a",
    revision: 2,
    scope: "user",
  });
  commercialOperationsHttpState.command.mockReset().mockResolvedValue({ plan: {} });
  commercialOperationsHttpState.adminPage.mockReset().mockResolvedValue({ plans: [] });
  commercialOperationsHttpState.adminDetail.mockReset();
  commercialOperationsHttpState.detail
    .mockReset()
    .mockResolvedValue({ attempts: [], canCancel: false });
  commercialOperationsHttpState.cancel.mockReset().mockResolvedValue({
    kind: "unpaid_order_cancelled",
    orderId: "ord_a",
    requestId: commercialOperationsHttpCancellation.requestId,
    cancelledAt: new Date("2026-10-10T12:00:00.001Z"),
  });
  commercialOperationsHttpConsumeRateLimit.mockReset().mockImplementation(async () => ({
    success: commercialOperationsHttpState.allowed,
  }));
}

/** Shared auth/db/security/env lifecycle for commercial-operations HTTP suites. */
export function installCommercialOperationsHttpHooks() {
  afterEach(() => {
    vi.unstubAllEnvs();
  });
  beforeEach(() => {
    stubBrowserMutationOrigin();
    vi.clearAllMocks();
    resetCommercialOperationsHttpState();
  });
}
