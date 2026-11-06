import { NextRequest } from "next/server";
import { afterEach, beforeEach, vi } from "vitest";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "../browser-mutation-headers";

/** Shared mutable fixtures for commercial-operations HTTP suites (not vi.hoisted). */
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

export const commercialOperationsHttpOrderCtx = { params: Promise.resolve({ id: "ord_a" }) };
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
  stubBrowserMutationOrigin();
  vi.clearAllMocks();
  const state = commercialOperationsHttpState;
  const cancellation = commercialOperationsHttpCancellation;
  const terms = commercialOperationsHttpTerms;
  state.user = { id: "usr_a", role: "admin" };
  state.allowed = true;
  state.catalog.mockReset().mockResolvedValue({ plans: [] });
  state.published
    .mockReset()
    .mockResolvedValue({ ...terms, id: "cplan_a", revision: 2, scope: "user" });
  state.command.mockReset().mockResolvedValue({ plan: {} });
  state.adminPage.mockReset().mockResolvedValue({ plans: [] });
  state.detail.mockReset().mockResolvedValue({ attempts: [], canCancel: false });
  state.cancel.mockReset().mockResolvedValue({
    kind: "unpaid_order_cancelled",
    orderId: "ord_a",
    requestId: cancellation.requestId,
    cancelledAt: new Date("2026-10-10T12:00:00.001Z"),
  });
}

/** Register shared lifecycle for commercial-operations HTTP suites. */
export function installCommercialOperationsHttpLifecycle() {
  beforeEach(resetCommercialOperationsHttpState);
  afterEach(() => {
    vi.unstubAllEnvs();
  });
}
