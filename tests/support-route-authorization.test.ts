import { AppError } from "@nexus/domain";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { SUPPORT_JSON_MAX_BYTES } from "../apps/web/src/lib/bounded-json";

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  const { supportRouteAfterMock } = await import("./helpers/support-route-harness");
  return { ...actual, after: supportRouteAfterMock };
});

vi.mock("../apps/web/src/lib/services/auth-service", async () => {
  const { supportRouteMocks } = await import("./helpers/support-route-harness");
  return { authService: { getSession: supportRouteMocks.session } };
});

vi.mock("@nexus/security", async () => {
  const { createSupportRouteSecurityMock } = await import("./helpers/support-route-harness");
  return createSupportRouteSecurityMock();
});

vi.mock("@nexus/db", async () => {
  const { createSupportRouteDbMock } = await import("./helpers/support-route-harness");
  return createSupportRouteDbMock();
});

vi.mock("../apps/web/src/lib/services/notification-dispatch-service", async () => {
  const { supportRouteMocks } = await import("./helpers/support-route-harness");
  return { dispatchNotificationsBestEffort: supportRouteMocks.dispatch };
});

import {
  POST as addMessage,
  GET as getCase,
  PATCH as updateCase,
} from "../apps/web/src/app/api/support/[id]/route";
import { POST as createCase, GET as listCases } from "../apps/web/src/app/api/support/route";
import {
  expectSupportPrivate,
  installSupportRouteLifecycle,
  supportCaseId,
  supportMutationHeaders,
  supportPrivateGet,
  supportRouteAfterMock,
  supportRouteMocks,
  supportRouteParams,
} from "./helpers/support-route-harness";

const caseId = supportCaseId;
const params = supportRouteParams;
const supportHeaders = supportMutationHeaders;
const mocks = supportRouteMocks;
const afterMock = supportRouteAfterMock;
const expectPrivate = expectSupportPrivate;
const privateGet = supportPrivateGet;

installSupportRouteLifecycle();

describe("support HTTP authorization", () => {
  it.each([
    ["create", "POST", createCase],
    ["reply", "POST", addMessage],
    ["status", "PATCH", updateCase],
  ] as const)(
    "rejects %s without a cookie before session lookup or body reads",
    async (_name, method, handler) => {
      mocks.session.mockResolvedValue({ id: "usr_member", role: "user" });
      const headers = new Headers(supportHeaders);
      headers.delete("cookie");
      const request = new NextRequest(`https://nexus.test/api/support/${caseId}`, {
        method,
        headers,
        body: JSON.stringify({ message: "Untrusted body" }),
      });
      const response = await handler(request, params);
      expect(response.status).toBe(401);
      expectPrivate(response);
      expect(request.bodyUsed).toBe(false);
      expect(mocks.session).not.toHaveBeenCalled();
      expect(mocks.findById).not.toHaveBeenCalled();
      expect(mocks.findMutationReplay).not.toHaveBeenCalled();
    },
  );

  it("rejects oversized support creation before persistence or notifications", async () => {
    mocks.session.mockResolvedValue({ id: "usr_member", role: "user" });
    const response = await createCase(
      new NextRequest("https://nexus.test/api/support", {
        method: "POST",
        headers: supportHeaders,
        body: JSON.stringify({
          category: "account",
          subject: "Large request",
          message: "a".repeat(SUPPORT_JSON_MAX_BYTES),
        }),
      }),
    );
    expect(response.status).toBe(413);
    expectPrivate(response);
    expect(await response.json()).toMatchObject({ code: "SUPPORT_BODY_TOO_LARGE" });
    expect(mocks.createIdempotentCase).not.toHaveBeenCalled();
    expect(afterMock).not.toHaveBeenCalled();
  });

  it("rejects oversized replies before touching the durable case", async () => {
    mocks.session.mockResolvedValue({ id: "usr_member", role: "user" });
    mocks.findById.mockResolvedValue({
      id: caseId,
      requesterId: "usr_member",
      subject: "Account help",
      status: "open",
    });
    const response = await addMessage(
      new NextRequest(`https://nexus.test/api/support/${caseId}`, {
        method: "POST",
        headers: supportHeaders,
        body: JSON.stringify({
          message: "a".repeat(SUPPORT_JSON_MAX_BYTES),
          expectedStatus: "open",
        }),
      }),
      params,
    );
    expect(response.status).toBe(413);
    expectPrivate(response);
    expect(await response.json()).toMatchObject({ code: "SUPPORT_BODY_TOO_LARGE" });
    expect(mocks.addIdempotentMessage).not.toHaveBeenCalled();
    expect(afterMock).not.toHaveBeenCalled();
  });

  it("rejects oversized moderator status changes without a database write", async () => {
    mocks.session.mockResolvedValue({ id: "usr_staff", role: "moderator" });
    mocks.can.mockReturnValue(true);
    mocks.findById.mockResolvedValue({
      id: caseId,
      requesterId: "usr_member",
      subject: "Account help",
      status: "open",
    });
    const response = await updateCase(
      new NextRequest(`https://nexus.test/api/support/${caseId}`, {
        method: "PATCH",
        headers: { ...supportHeaders, "x-nexus-actor-id": "usr_staff" },
        body: JSON.stringify({
          status: "closed",
          expectedStatus: "open",
          padding: "a".repeat(SUPPORT_JSON_MAX_BYTES),
        }),
      }),
      params,
    );
    expect(response.status).toBe(413);
    expectPrivate(response);
    expect(await response.json()).toMatchObject({ code: "SUPPORT_BODY_TOO_LARGE" });
    expect(mocks.updateStatus).not.toHaveBeenCalled();
    expect(afterMock).not.toHaveBeenCalled();
  });

  it("requires moderation capability for the staff queue", async () => {
    mocks.session.mockResolvedValue({ id: "usr_member", role: "user" });
    const request = privateGet("https://nexus.test/api/support?scope=staff");

    const denied = await listCases(request);
    expect(denied.status).toBe(403);
    expectPrivate(denied);
    expect(mocks.pageStaff).not.toHaveBeenCalled();

    mocks.can.mockReturnValue(true);
    mocks.pageStaff.mockResolvedValue({
      items: [
        {
          supportCase: { id: caseId, requesterId: "usr_other" },
          requesterUsername: "other",
          requesterDisplayName: "Other",
        },
      ],
      page: 1,
      pageSize: 25,
      total: 1,
      totalPages: 1,
    });
    const allowed = await listCases(request);
    expect(allowed.status).toBe(200);
    expectPrivate(allowed);
    expect(mocks.pageStaff).toHaveBeenCalledWith(1, 25, {}, "usr_member", "initiating-token");
  });

  it("uses current repository permissions instead of staff claims in the session", async () => {
    mocks.session.mockResolvedValue({ id: "usr_member", role: "user" });
    mocks.can.mockReturnValue(true);
    mocks.authorizedThread.mockRejectedValue(new AppError("Hidden", 404, "NOT_FOUND"));

    const request = privateGet(`https://nexus.test/api/support/${caseId}`);
    const hidden = await getCase(request, params);
    expect(hidden.status).toBe(404);
    expectPrivate(hidden);
    expect(mocks.pageMessages).not.toHaveBeenCalled();

    mocks.authorizedThread.mockResolvedValue({
      supportCase: { id: caseId, status: "open" },
      staff: true,
      requester: false,
      messages: {
        items: [{ id: "spm_1", body: "private" }],
        page: 1,
        pageSize: 100,
        total: 1,
        totalPages: 1,
      },
    });
    const allowed = await getCase(request, params);
    expect(allowed.status).toBe(200);
    expectPrivate(allowed);
    expect(mocks.authorizedThread).toHaveBeenCalledWith(
      caseId,
      "usr_member",
      1,
      "initiating-token",
    );
    expect(mocks.findById).not.toHaveBeenCalled();
    expect(mocks.can).not.toHaveBeenCalled();
  });

  it("returns 401 without private data if the initiating session expires before a read", async () => {
    mocks.session.mockResolvedValue({ id: "usr_member", role: "user" });
    mocks.authorizedThread.mockRejectedValueOnce(
      new AppError("Authentication required", 401, "UNAUTHORIZED"),
    );
    const response = await getCase(privateGet(`https://nexus.test/api/support/${caseId}`), params);
    expect(response.status).toBe(401);
    expectPrivate(response);
    expect(await response.json()).toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.authorizedThread).toHaveBeenCalledWith(
      caseId,
      "usr_member",
      1,
      "initiating-token",
    );
  });

  it("limits private thread reads before loading message bodies", async () => {
    mocks.session.mockResolvedValue({ id: "usr_member", role: "user" });
    mocks.rate.mockResolvedValue({ success: false });
    const response = await getCase(privateGet(`https://nexus.test/api/support/${caseId}`), params);
    expect(response.status).toBe(429);
    expectPrivate(response);
    expect(mocks.authorizedThread).not.toHaveBeenCalled();
  });

  it("keeps status changes staff-only and closed threads immutable to replies", async () => {
    mocks.session.mockResolvedValue({ id: "usr_member", role: "user" });
    mocks.findById.mockResolvedValue({
      id: caseId,
      requesterId: "usr_member",
      status: "open",
    });

    const patchRequest = new NextRequest(`https://nexus.test/api/support/${caseId}`, {
      method: "PATCH",
      headers: supportHeaders,
      body: JSON.stringify({ status: "resolved", expectedStatus: "open" }),
    });
    const denied = await updateCase(patchRequest, params);
    expect(denied.status).toBe(403);
    expectPrivate(denied);
    expect(mocks.updateStatus).not.toHaveBeenCalled();

    mocks.addIdempotentMessage.mockResolvedValueOnce({ kind: "stale" });
    mocks.findById.mockResolvedValueOnce({
      id: caseId,
      requesterId: "usr_member",
      status: "closed",
    });
    const reply = await addMessage(
      new NextRequest(`https://nexus.test/api/support/${caseId}`, {
        method: "POST",
        headers: supportHeaders,
        body: JSON.stringify({ message: "Please reopen this issue.", expectedStatus: "open" }),
      }),
      params,
    );
    expect(reply.status).toBe(409);
    expectPrivate(reply);
    expect(await reply.json()).toMatchObject({
      code: "SUPPORT_CASE_CLOSED",
    });
  });
});
