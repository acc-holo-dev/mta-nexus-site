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
  supportRouteState,
} from "./helpers/support-route-harness";

const caseId = supportCaseId;
const params = supportRouteParams;
const supportHeaders = supportMutationHeaders;
const mocks = supportRouteMocks;
const afterMock = supportRouteAfterMock;
const expectPrivate = expectSupportPrivate;
const privateGet = supportPrivateGet;
const state = supportRouteState;

installSupportRouteLifecycle();

describe("support HTTP authorization and privacy", () => {
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

  it("keeps unauthenticated and authenticated case lists private", async () => {
    const request = privateGet("https://nexus.test/api/support");
    const denied = await listCases(request);
    expect(denied.status).toBe(401);
    expectPrivate(denied);

    mocks.session.mockResolvedValue({ id: "usr_member", role: "user" });
    mocks.pageByRequester.mockResolvedValue({
      items: [{ id: caseId }],
      page: 1,
      pageSize: 25,
      total: 1,
      totalPages: 1,
    });
    const allowed = await listCases(request);
    expect(allowed.status).toBe(200);
    expectPrivate(allowed);
    expect(mocks.pageByRequester).toHaveBeenCalledWith("usr_member", 1, 25, {}, "initiating-token");
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

  it("filters authorized staff queues with the same bounded page metadata", async () => {
    mocks.session.mockResolvedValue({ id: "usr_staff", role: "moderator" });
    mocks.can.mockReturnValue(true);
    mocks.pageStaff.mockResolvedValue({
      items: [],
      page: 3,
      pageSize: 25,
      total: 53,
      totalPages: 3,
    });

    const response = await listCases(
      privateGet("https://nexus.test/api/support?scope=staff&page=3&status=open&category=payment"),
    );
    expect(response.status).toBe(200);
    expectPrivate(response);
    expect(await response.json()).toMatchObject({ page: 3, total: 53, totalPages: 3 });
    expect(mocks.pageStaff).toHaveBeenCalledWith(
      3,
      25,
      {
        status: "open",
        category: "payment",
      },
      "usr_staff",
      "initiating-token",
    );
    expect(mocks.pageByRequester).not.toHaveBeenCalled();
  });

  it.each([
    "status=under_review",
    "category=invalid",
    "page=10000",
    "status=open&status=closed",
    "category=account&category=payment",
  ])("rejects invalid staff queue filters: %s", async (query) => {
    mocks.session.mockResolvedValue({ id: "usr_staff", role: "moderator" });
    mocks.can.mockReturnValue(true);
    const response = await listCases(
      privateGet(`https://nexus.test/api/support?scope=staff&${query}`),
    );
    expect(response.status).toBe(400);
    expectPrivate(response);
    expect(mocks.pageStaff).not.toHaveBeenCalled();
    expect(mocks.pageByRequester).not.toHaveBeenCalled();
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

  it("rejects invalid page queries before reading private cases", async () => {
    mocks.session.mockResolvedValue({ id: "usr_member", role: "user" });
    const response = await listCases(privateGet("https://nexus.test/api/support?page=0"));
    expect(response.status).toBe(400);
    expectPrivate(response);
    expect(mocks.pageByRequester).not.toHaveBeenCalled();
  });

  it("passes a bounded message page into the repository", async () => {
    mocks.session.mockResolvedValue({ id: "usr_member", role: "user" });
    mocks.authorizedThread.mockResolvedValue({
      supportCase: { id: caseId, status: "open" },
      staff: false,
      requester: true,
      messages: { items: [], page: 7, pageSize: 100, total: 601, totalPages: 7 },
    });

    const response = await getCase(
      privateGet(`https://nexus.test/api/support/${caseId}?messagePage=7`),
      params,
    );
    expect(response.status).toBe(200);
    expect(mocks.authorizedThread).toHaveBeenCalledWith(
      caseId,
      "usr_member",
      7,
      "initiating-token",
    );
    expect(await response.json()).toMatchObject({
      messagePage: 7,
      messageTotalPages: 7,
      messageTotal: 601,
    });
  });

  it.each([
    "messagePage=0",
    "messagePage=-1",
    "messagePage=1&messagePage=2",
    "messagePage=10000000",
    "messagePage=1e2",
  ])("rejects malformed private message pagination %s", async (query) => {
    mocks.session.mockResolvedValue({ id: "usr_member", role: "user" });
    const response = await getCase(
      privateGet(`https://nexus.test/api/support/${caseId}?${query}`),
      params,
    );
    expect(response.status).toBe(400);
    expectPrivate(response);
    expect(mocks.authorizedThread).not.toHaveBeenCalled();
  });

  it("limits private thread reads before loading message bodies", async () => {
    mocks.session.mockResolvedValue({ id: "usr_member", role: "user" });
    mocks.rate.mockResolvedValue({ success: false });
    const response = await getCase(privateGet(`https://nexus.test/api/support/${caseId}`), params);
    expect(response.status).toBe(429);
    expectPrivate(response);
    expect(mocks.authorizedThread).not.toHaveBeenCalled();
  });

  it("rejects client-forged related entity context before persistence", async () => {
    mocks.session.mockResolvedValue({ id: "usr_member", role: "user" });
    const response = await createCase(
      new NextRequest("https://nexus.test/api/support", {
        method: "POST",
        headers: supportHeaders,
        body: JSON.stringify({
          category: "purchase",
          subject: "Please check this purchase",
          message: "I should not be able to attach someone else's order.",
          relatedType: "purchase",
          relatedId: "ord_someone_else",
        }),
      }),
    );

    expect(response.status).toBe(400);
    expectPrivate(response);
    expect(mocks.createIdempotentCase).not.toHaveBeenCalled();
  });

  it("persists a valid new case with an audit event", async () => {
    mocks.session.mockResolvedValue({ id: "usr_member", role: "user" });
    const response = await createCase(
      new NextRequest("https://nexus.test/api/support", {
        method: "POST",
        headers: supportHeaders,
        body: JSON.stringify({
          category: "account",
          subject: "Account access problem",
          message: "Recovery completed, but I still cannot access my account.",
        }),
      }),
    );

    expect(response.status).toBe(201);
    expectPrivate(response);
    expect(mocks.createIdempotentCase).toHaveBeenCalledWith(
      expect.objectContaining({
        id: caseId,
        requesterId: "usr_member",
        category: "account",
      }),
      expect.objectContaining({
        caseId,
        authorId: "usr_member",
        authorRole: "requester",
      }),
      expect.objectContaining({
        actorId: "usr_member",
        action: "support.case.created",
        targetId: caseId,
      }),
      expect.objectContaining({ actorId: "usr_member", operation: "case", caseId }),
      "initiating-token",
      null,
    );
  });

  it("leaves support notifications to transactional repository delivery", async () => {
    mocks.session.mockResolvedValue({ id: "usr_member", role: "user" });
    const createResponse = await createCase(
      new NextRequest("https://nexus.test/api/support", {
        method: "POST",
        headers: supportHeaders,
        body: JSON.stringify({
          category: "account",
          subject: "Account access problem",
          message: "Recovery completed, but access is still unavailable.",
        }),
      }),
    );
    expect(createResponse.status).toBe(201);
    expect(afterMock).not.toHaveBeenCalled();
    expect(mocks.dispatch).not.toHaveBeenCalled();

    vi.clearAllMocks();
    state.afterCallbacks.length = 0;
    mocks.session.mockResolvedValue({ id: "usr_staff", role: "moderator" });
    mocks.can.mockReturnValue(true);
    mocks.findById.mockResolvedValue({
      id: caseId,
      requesterId: "usr_member",
      subject: "Account help",
      status: "open",
    });
    const reply = await addMessage(
      new NextRequest(`https://nexus.test/api/support/${caseId}`, {
        method: "POST",
        headers: { ...supportHeaders, "x-nexus-actor-id": "usr_staff" },
        body: JSON.stringify({ message: "We restored the account.", expectedStatus: "open" }),
      }),
      params,
    );
    expect(reply.status).toBe(201);
    expect(mocks.dispatch).not.toHaveBeenCalled();
    expect(afterMock).not.toHaveBeenCalled(); // Requester inbox is now part of repository persistence.

    vi.clearAllMocks();
    state.afterCallbacks.length = 0;
    mocks.session.mockResolvedValue({ id: "usr_staff", role: "moderator" });
    mocks.can.mockReturnValue(true);
    mocks.findById.mockResolvedValue({
      id: caseId,
      requesterId: "usr_member",
      subject: "Account help",
      status: "open",
    });
    mocks.updateStatus.mockResolvedValue({
      id: caseId,
      requesterId: "usr_member",
      subject: "Account help",
      status: "resolved",
    });
    const statusResponse = await updateCase(
      new NextRequest(`https://nexus.test/api/support/${caseId}`, {
        method: "PATCH",
        headers: { ...supportHeaders, "x-nexus-actor-id": "usr_staff" },
        body: JSON.stringify({ status: "resolved", expectedStatus: "open" }),
      }),
      params,
    );
    expect(statusResponse.status).toBe(200);
    expect(mocks.dispatch).not.toHaveBeenCalled();
    expect(afterMock).not.toHaveBeenCalled(); // No duplicate post-commit requester notice.
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

  it("rejects a stale reply when moderation changed the case after authorization", async () => {
    mocks.session.mockResolvedValue({
      id: "usr_member",
      role: "user",
    });
    mocks.findById
      .mockResolvedValueOnce({
        id: caseId,
        requesterId: "usr_member",
        status: "open",
      })
      .mockResolvedValueOnce({
        id: caseId,
        requesterId: "usr_member",
        status: "resolved",
      });
    mocks.addIdempotentMessage.mockResolvedValueOnce({ kind: "stale" });

    const response = await addMessage(
      new NextRequest(`https://nexus.test/api/support/${caseId}`, {
        method: "POST",
        headers: supportHeaders,
        body: JSON.stringify({
          message: "This reply raced with moderation.",
          expectedStatus: "open",
        }),
      }),
      params,
    );

    expect(response.status).toBe(409);
    expectPrivate(response);
    expect(await response.json()).toMatchObject({
      code: "SUPPORT_MESSAGE_CONFLICT",
    });
    expect(mocks.addIdempotentMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId,
        expectedStatus: "open",
      }),
      expect.any(Object),
      expect.objectContaining({ actorId: "usr_member", operation: "reply", caseId }),
      "initiating-token",
    );
    expect(afterMock).not.toHaveBeenCalled();
  });

  it("requires a client-observed status before accepting replies", async () => {
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
        body: JSON.stringify({ message: "This request has no state precondition." }),
      }),
      params,
    );
    expect(response.status).toBe(400);
    expectPrivate(response);
    expect(mocks.addIdempotentMessage).not.toHaveBeenCalled();
    expect(afterMock).not.toHaveBeenCalled();
  });

  it("rejects a reply composed before another moderator resolved the ticket", async () => {
    mocks.session.mockResolvedValue({ id: "usr_member", role: "user" });
    mocks.findById.mockResolvedValue({
      id: caseId,
      requesterId: "usr_member",
      subject: "Account help",
      status: "resolved",
    });
    const response = await addMessage(
      new NextRequest(`https://nexus.test/api/support/${caseId}`, {
        method: "POST",
        headers: supportHeaders,
        body: JSON.stringify({ message: "I was reading an open thread.", expectedStatus: "open" }),
      }),
      params,
    );
    expect(response.status).toBe(409);
    expectPrivate(response);
    expect(await response.json()).toMatchObject({ code: "SUPPORT_MESSAGE_CONFLICT" });
    expect(mocks.addIdempotentMessage).not.toHaveBeenCalled();
    expect(afterMock).not.toHaveBeenCalled();
  });

  it("allows a deliberate reply to a resolved ticket, reopening it atomically", async () => {
    mocks.session.mockResolvedValue({ id: "usr_member", role: "user" });
    mocks.findById.mockResolvedValue({
      id: caseId,
      requesterId: "usr_member",
      subject: "Account help",
      status: "resolved",
    });
    const response = await addMessage(
      new NextRequest(`https://nexus.test/api/support/${caseId}`, {
        method: "POST",
        headers: supportHeaders,
        body: JSON.stringify({ message: "I still need assistance.", expectedStatus: "resolved" }),
      }),
      params,
    );
    expect(response.status).toBe(201);
    expectPrivate(response);
    expect(mocks.addIdempotentMessage).toHaveBeenCalledWith(
      expect.objectContaining({ caseId, expectedStatus: "resolved" }),
      expect.any(Object),
      expect.objectContaining({ actorId: "usr_member", operation: "reply", caseId }),
      "initiating-token",
    );
    expect(afterMock).not.toHaveBeenCalled();
  });

  it("rejects replies to already closed tickets before repository mutation", async () => {
    mocks.session.mockResolvedValue({ id: "usr_member", role: "user" });
    mocks.findById.mockResolvedValue({
      id: caseId,
      requesterId: "usr_member",
      subject: "Account help",
      status: "closed",
    });
    const response = await addMessage(
      new NextRequest(`https://nexus.test/api/support/${caseId}`, {
        method: "POST",
        headers: supportHeaders,
        body: JSON.stringify({
          message: "The ticket is already closed.",
          expectedStatus: "closed",
        }),
      }),
      params,
    );
    expect(response.status).toBe(409);
    expectPrivate(response);
    expect(await response.json()).toMatchObject({ code: "SUPPORT_CASE_CLOSED" });
    expect(mocks.addIdempotentMessage).not.toHaveBeenCalled();
    expect(afterMock).not.toHaveBeenCalled();
  });
});

it.each([
  ["create", "POST", createCase],
  ["reply", "POST", addMessage],
  ["status", "PATCH", updateCase],
] as const)(
  "rejects %s for a different displayed actor before persistence",
  async (_name, method, handler) => {
    mocks.session.mockResolvedValue({ id: "usr_other", role: "moderator" });
    mocks.can.mockReturnValue(true);
    mocks.findById.mockResolvedValue({ id: caseId, requesterId: "usr_member", status: "open" });
    const response = await handler(
      new NextRequest(`https://nexus.test/api/support/${caseId}`, {
        method,
        headers: supportHeaders,
        body: JSON.stringify({ message: "Must not be sent by a different actor" }),
      }),
      params,
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "ACTOR_CHANGED" });
    expect(mocks.findMutationReplay).not.toHaveBeenCalled();
    expect(mocks.createIdempotentCase).not.toHaveBeenCalled();
    expect(mocks.addIdempotentMessage).not.toHaveBeenCalled();
    expect(mocks.updateStatus).not.toHaveBeenCalled();
  },
);

it.each([
  ["create", "POST", createCase],
  ["reply", "POST", addMessage],
  ["status", "PATCH", updateCase],
] as const)("requires the displayed actor for %s", async (_name, method, handler) => {
  mocks.session.mockResolvedValue({ id: "usr_member", role: "user" });
  mocks.findById.mockResolvedValue({ id: caseId, requesterId: "usr_member", status: "open" });
  const headers = new Headers(supportHeaders);
  headers.delete("x-nexus-actor-id");
  const response = await handler(
    new NextRequest(`https://nexus.test/api/support/${caseId}`, {
      method,
      headers,
      body: JSON.stringify({ message: "A required actor precondition" }),
    }),
    params,
  );
  expect(response.status).toBe(428);
  expect(await response.json()).toMatchObject({ code: "ACTOR_ID_REQUIRED" });
  expect(mocks.createIdempotentCase).not.toHaveBeenCalled();
  expect(mocks.addIdempotentMessage).not.toHaveBeenCalled();
  expect(mocks.updateStatus).not.toHaveBeenCalled();
});
