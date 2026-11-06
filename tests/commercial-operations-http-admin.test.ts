import { AppError } from "@nexus/domain";
import { expect, it, vi } from "vitest";

vi.mock("../apps/web/src/lib/services/auth-service", async () => {
  const { commercialOperationsHttpState } = await import(
    "./helpers/commercial-operations-http-harness"
  );
  return {
    authService: { getSession: async () => commercialOperationsHttpState.user },
  };
});
vi.mock("@nexus/db", async () => {
  const { commercialOperationsHttpState } = await import(
    "./helpers/commercial-operations-http-harness"
  );
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
});
vi.mock("@nexus/security", async (importOriginal) => {
  const { commercialOperationsHttpState } = await import(
    "./helpers/commercial-operations-http-harness"
  );
  return {
    ...(await importOriginal<typeof import("@nexus/security")>()),
    consumeRateLimit: vi.fn(async () => ({ success: commercialOperationsHttpState.allowed })),
  };
});

import { consumeRateLimit } from "@nexus/security";
import { POST as edit } from "../apps/web/src/app/api/admin/commerce/plans/[id]/route";
import {
  GET as adminPage,
  POST as create,
} from "../apps/web/src/app/api/admin/commerce/plans/route";
import { POST as cancel } from "../apps/web/src/app/api/orders/[id]/cancel/route";
import { GET as detail } from "../apps/web/src/app/api/orders/[id]/operations/route";
import {
  commercialOperationsHttpCancellation as cancellation,
  commercialOperationsHttpOrderCtx as ctx,
  commercialOperationsHttpPlanCtx as planCtx,
  commercialOperationsHttpRequest as request,
  commercialOperationsHttpState as state,
  commercialOperationsHttpTerms as terms,
  installCommercialOperationsHttpLifecycle,
} from "./helpers/commercial-operations-http-harness";

installCommercialOperationsHttpLifecycle();

it.each(["user", "moderator"] as const)(
  "keeps plan administration out of %s authority",
  async (role) => {
    state.user = { id: "usr_a", role };
    expect((await adminPage(request("/api/admin/commerce/plans"))).status).toBe(403);
    expect(
      (
        await create(
          request("/api/admin/commerce/plans", {
            action: "create",
            slug: "seller-plan",
            scope: "user",
            terms,
            reason: "Terms checked",
          }),
        )
      ).status,
    ).toBe(403);
    expect(state.adminPage).not.toHaveBeenCalled();
    expect(state.command).not.toHaveBeenCalled();
  },
);
it("passes the actual actor and a validated draft command with private response headers", async () => {
  const response = await create(
    request("/api/admin/commerce/plans", {
      action: "create",
      slug: "seller-plan",
      scope: "user",
      terms,
      reason: "Terms checked",
    }),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("Vary")).toBe("Cookie");
  expect(state.command).toHaveBeenCalledWith(
    expect.objectContaining({
      actorId: "usr_a",
      currentToken: "plan-admin-token",
      planId: expect.stringMatching(/^cplan_/u),
      command: expect.objectContaining({ action: "create", terms }),
    }),
  );
  expect(consumeRateLimit).toHaveBeenCalledWith("moderationAction", "usr_a");
});
it("rejects a create command sent to an existing plan", async () => {
  expect(
    (
      await edit(
        request("/api/admin/commerce/plans/cplan_a", {
          action: "create",
          slug: "seller-plan",
          scope: "user",
          terms,
          reason: "Terms checked",
        }),
        planCtx,
      )
    ).status,
  ).toBe(400);
  expect(state.command).not.toHaveBeenCalled();
});
it.each([
  [{ "sec-fetch-site": "cross-site" }, cancellation, 403],
  [{ "content-type": "text/plain" }, cancellation, 415],
  [{}, { ...cancellation, padding: "x".repeat(5000) }, 413],
  [{}, { ...cancellation, buyerId: "usr_other" }, 400],
] as const)("rejects unsafe cancellation before mutation", async (headers, body, status) => {
  expect((await cancel(request("/api/orders/ord_a/cancel", body, headers), ctx)).status).toBe(
    status,
  );
  expect(state.cancel).not.toHaveBeenCalled();
});
it("takes cancellation ownership only from the session and returns a durable timestamp", async () => {
  const response = await cancel(request("/api/orders/ord_a/cancel", cancellation), ctx);
  expect(response.status).toBe(200);
  expect(state.cancel).toHaveBeenCalledWith(
    expect.objectContaining({
      buyerId: "usr_a",
      currentToken: "plan-admin-token",
      orderId: "ord_a",
      command: cancellation,
    }),
  );
  expect(await response.json()).toMatchObject({ cancelledAt: "2026-10-10T12:00:00.001Z" });
});
it("requires the cancellation cookie before parsing a body even with a cached actor", async () => {
  const input = request("/api/orders/ord_a/cancel", cancellation);
  input.cookies.delete("nexus_session");
  expect((await cancel(input, ctx)).status).toBe(401);
  expect(input.bodyUsed).toBe(false);
  expect(state.cancel).not.toHaveBeenCalled();
});
it("does not disclose internal reconciliation details", async () => {
  state.cancel.mockRejectedValue(
    new AppError("PRIVATE PROVIDER DETAIL", 409, "ORDER_RECONCILIATION_REQUIRED"),
  );
  expect(
    await (await cancel(request("/api/orders/ord_a/cancel", cancellation), ctx)).json(),
  ).toEqual({ code: "ORDER_RECONCILIATION_REQUIRED" });
});
it("requires login before fetching the buyer archive or cancelling", async () => {
  state.user = null;
  expect((await detail(request("/api/orders/ord_a/operations"), ctx)).status).toBe(401);
  expect((await cancel(request("/api/orders/ord_a/cancel", cancellation), ctx)).status).toBe(401);
  expect(state.detail).not.toHaveBeenCalled();
  expect(state.cancel).not.toHaveBeenCalled();
});

it("requires the initiating cookie even when the cached actor is an administrator", async () => {
  for (const handler of [create, edit]) {
    const input = request("/api/admin/commerce/plans/cplan_a", {
      action: "publish",
      expectedRevision: 1,
      reason: "Review terms",
    });
    input.cookies.delete("nexus_session");
    expect((await handler(input, planCtx)).status).toBe(401);
    expect(input.bodyUsed).toBe(false);
  }
  expect(state.command).not.toHaveBeenCalled();
});

it("forwards the initiating cookie for an existing plan command", async () => {
  const command = { action: "publish", expectedRevision: 2, reason: "Approve current terms" };
  const response = await edit(request("/api/admin/commerce/plans/cplan_a", command), planCtx);
  expect(response.status).toBe(200);
  expect(state.command).toHaveBeenCalledWith(
    expect.objectContaining({
      actorId: "usr_a",
      currentToken: "plan-admin-token",
      planId: "cplan_a",
      command,
    }),
  );
});

it.each(["create", "edit"] as const)(
  "requires the originating administrator for plan %s",
  async (kind) => {
    const command =
      kind === "create"
        ? { action: "create", slug: "seller-plan", scope: "user", terms, reason: "A valid reason" }
        : { action: "archive", expectedRevision: 2, reason: "A valid reason" };
    const run = (actorId: string) =>
      kind === "create"
        ? create(request("/api/admin/commerce/plans", command, { "x-nexus-actor-id": actorId }))
        : edit(
            request("/api/admin/commerce/plans/cplan_a", command, { "x-nexus-actor-id": actorId }),
            planCtx,
          );
    expect((await run("")).status).toBe(428);
    const response = await run("usr_b");
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "ACTOR_CHANGED" });
    expect(state.command).not.toHaveBeenCalled();
  },
);

it("requires the original buyer before cancelling an order", async () => {
  expect(
    (
      await cancel(
        request("/api/orders/ord_a/cancel", cancellation, { "x-nexus-actor-id": "" }),
        ctx,
      )
    ).status,
  ).toBe(428);
  const response = await cancel(
    request("/api/orders/ord_a/cancel", cancellation, { "x-nexus-actor-id": "usr_other" }),
    ctx,
  );
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ code: "ACTOR_CHANGED" });
  expect(state.cancel).not.toHaveBeenCalled();
});
