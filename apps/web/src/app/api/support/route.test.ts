import { NextRequest } from "next/server";
import { SUPPORT_JSON_MAX_BYTES } from "../../../lib/bounded-json";
import { AppError } from "@nexus/domain";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  browserMutationHeaders,
  stubBrowserMutationOrigin,
} from "../../../../../../tests/browser-mutation-headers";

const state = vi.hoisted(() => ({
  afterCallbacks: [] as Array<() => unknown | Promise<unknown>>,
}));

const mocks = vi.hoisted(() => ({
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
}));

const afterMock = vi.hoisted(() =>
  vi.fn((callback: () => unknown | Promise<unknown>) => {
    state.afterCallbacks.push(callback);
  }),
);

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual, after: afterMock };
});

vi.mock("../../../lib/services/auth-service", () => ({
  authService: { getSession: mocks.session },
}));

vi.mock("@nexus/security", () => ({
  can: mocks.can,
  consumeRateLimit: mocks.rate,
  generateId: (prefix: string) => `${prefix}_${"a".repeat(24)}`,
}));

vi.mock("@nexus/db", () => ({
  supportCaseRepository: {
    pageByRequester: mocks.pageByRequester,
    pageStaff: mocks.pageStaff,
    findById: mocks.findById,
    pageMessages: mocks.pageMessages,
    authorizedThread: mocks.authorizedThread,
    createIdempotentCase: mocks.createIdempotentCase,
    addIdempotentMessage: mocks.addIdempotentMessage,
    findMutationReplay: mocks.findMutationReplay,
    updateStatus: mocks.updateStatus,
  },
  userRepository: { listModeratorIds: mocks.moderatorIds },
}));

vi.mock("../../../lib/services/notification-dispatch-service", () => ({
  dispatchNotificationsBestEffort: mocks.dispatch,
}));

import { GET as listCases, POST as createCase } from "./route";
import { GET as getCase, PATCH as updateCase, POST as addMessage } from "./[id]/route";

const caseId = `sup_${"a".repeat(24)}`;
const params = { params: Promise.resolve({ id: caseId }) };
const supportHeaders = {
  ...browserMutationHeaders(),
  "content-type": "application/json",
  "Idempotency-Key": "12345678-1234-4234-8234-123456789abc",
};

function expectPrivate(response: Response) {
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(response.headers.get("x-request-id")).toBeTruthy();
}

beforeEach(() => {
  stubBrowserMutationOrigin();
  vi.clearAllMocks();
  for (const mock of Object.values(mocks)) mock.mockReset();
  state.afterCallbacks.length = 0;
  mocks.session.mockResolvedValue(null);
  mocks.can.mockReturnValue(false);
  mocks.rate.mockResolvedValue({ success: true });
  mocks.pageByRequester.mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 1,
  });
  mocks.pageStaff.mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 1,
  });
  mocks.findById.mockResolvedValue(null);
  mocks.pageMessages.mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 100,
    total: 0,
    totalPages: 1,
  });
  mocks.findMutationReplay.mockResolvedValue({ kind: "missing" });
  mocks.createIdempotentCase.mockResolvedValue({
    kind: "created",
    supportCase: {
      id: caseId,
      requesterId: "usr_member",
      category: "account",
      subject: "Account help",
      status: "open",
    },
  });
  mocks.addIdempotentMessage.mockResolvedValue({
    kind: "created",
    supportCase: { id: caseId, status: "open" },
    message: { id: `spm_${"a".repeat(24)}`, authorRole: "requester" },
  });
  mocks.updateStatus.mockResolvedValue({
    id: caseId,
    requesterId: "usr_member",
    subject: "Account help",
    status: "resolved",
  });
  mocks.moderatorIds.mockResolvedValue(["usr_mod"]);
  mocks.dispatch.mockResolvedValue({
    requested: 1,
    stored: 1,
    storageFailed: 0,
    pushQueued: 1,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("support HTTP authorization and privacy", () => {
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
        headers: supportHeaders,
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
    const request = new NextRequest("https://nexus.test/api/support");
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
    expect(mocks.pageByRequester).toHaveBeenCalledWith("usr_member", 1);
  });

  it("requires moderation capability for the staff queue", async () => {
    mocks.session.mockResolvedValue({ id: "usr_member", role: "user" });
    const request = new NextRequest("https://nexus.test/api/support?scope=staff");

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
    expect(mocks.pageStaff).toHaveBeenCalledWith(1, 25, {}, "usr_member");
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
      new NextRequest(
        "https://nexus.test/api/support?scope=staff&page=3&status=open&category=payment",
      ),
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
      new NextRequest(`https://nexus.test/api/support?scope=staff&${query}`),
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

    const request = new NextRequest(`https://nexus.test/api/support/${caseId}`);
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
    expect(mocks.authorizedThread).toHaveBeenCalledWith(caseId, "usr_member", 1);
    expect(mocks.findById).not.toHaveBeenCalled();
    expect(mocks.can).not.toHaveBeenCalled();
  });

  it("rejects invalid page queries before reading private cases", async () => {
    mocks.session.mockResolvedValue({ id: "usr_member", role: "user" });
    const response = await listCases(new NextRequest("https://nexus.test/api/support?page=0"));
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
      new NextRequest(`https://nexus.test/api/support/${caseId}?messagePage=7`),
      params,
    );
    expect(response.status).toBe(200);
    expect(mocks.authorizedThread).toHaveBeenCalledWith(caseId, "usr_member", 7);
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
      new NextRequest(`https://nexus.test/api/support/${caseId}?${query}`),
      params,
    );
    expect(response.status).toBe(400);
    expectPrivate(response);
    expect(mocks.authorizedThread).not.toHaveBeenCalled();
  });

  it("limits private thread reads before loading message bodies", async () => {
    mocks.session.mockResolvedValue({ id: "usr_member", role: "user" });
    mocks.rate.mockResolvedValue({ success: false });
    const response = await getCase(
      new NextRequest(`https://nexus.test/api/support/${caseId}`),
      params,
    );
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
    );
  });

  it("delivers support notifications only after committed mutations", async () => {
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
    expect(afterMock).toHaveBeenCalledOnce();
    expect(mocks.dispatch).not.toHaveBeenCalled();
    await state.afterCallbacks.shift()?.();
    expect(mocks.dispatch).toHaveBeenCalledWith([
      expect.objectContaining({
        recipientId: "usr_mod",
        link: `/admin/support/${caseId}`,
      }),
    ]);

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
        headers: supportHeaders,
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
        headers: supportHeaders,
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
    );
    expect(afterMock).toHaveBeenCalledOnce();
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

describe("concurrent support moderation", () => {
  it("requires the last observed status before a staff mutation", async () => {
    mocks.session.mockResolvedValue({ id: "usr_staff", role: "moderator" });
    mocks.can.mockReturnValue(true);
    mocks.findById.mockResolvedValue({ id: caseId, requesterId: "usr_member", status: "open" });

    const response = await updateCase(
      new NextRequest(`https://nexus.test/api/support/${caseId}`, {
        method: "PATCH",
        headers: supportHeaders,
        body: JSON.stringify({ status: "closed" }),
      }),
      params,
    );

    expect(response.status).toBe(400);
    expectPrivate(response);
    expect(mocks.updateStatus).not.toHaveBeenCalled();
    expect(afterMock).not.toHaveBeenCalled();
  });

  it.each(["closed", "resolved"] as const)(
    "rejects a stale staff view even when requested status is %s",
    async (status) => {
      mocks.session.mockResolvedValue({ id: "usr_staff", role: "moderator" });
      mocks.can.mockReturnValue(true);
      // Staff viewed open; another moderator has since resolved the ticket.
      mocks.findById.mockResolvedValue({
        id: caseId,
        requesterId: "usr_member",
        status: "resolved",
      });

      const response = await updateCase(
        new NextRequest(`https://nexus.test/api/support/${caseId}`, {
          method: "PATCH",
          headers: supportHeaders,
          body: JSON.stringify({ status, expectedStatus: "open" }),
        }),
        params,
      );

      expect(response.status).toBe(409);
      expectPrivate(response);
      expect(await response.json()).toMatchObject({ code: "SUPPORT_STATUS_CONFLICT" });
      expect(mocks.updateStatus).not.toHaveBeenCalled();
      expect(afterMock).not.toHaveBeenCalled();
      expect(mocks.dispatch).not.toHaveBeenCalled();
    },
  );
  it("rechecks current authority through the repository even for a no-op status", async () => {
    mocks.session.mockResolvedValue({ id: "usr_staff", role: "moderator" });
    mocks.can.mockReturnValue(true);
    mocks.findById.mockResolvedValue({ id: caseId, requesterId: "usr_member", status: "resolved" });
    const response = await updateCase(
      new NextRequest(`https://nexus.test/api/support/${caseId}`, {
        method: "PATCH",
        headers: supportHeaders,
        body: JSON.stringify({ status: "resolved", expectedStatus: "resolved" }),
      }),
      params,
    );
    expect(response.status).toBe(200);
    expect(mocks.updateStatus).toHaveBeenCalledWith(
      caseId,
      "resolved",
      expect.any(Object),
      "resolved",
    );
    expect(afterMock).not.toHaveBeenCalled();
  });

  it("rejects stale status changes without sending notifications", async () => {
    mocks.session.mockResolvedValue({ id: "usr_staff", role: "moderator" });
    mocks.can.mockReturnValue(true);
    mocks.findById.mockResolvedValue({ id: caseId, requesterId: "usr_member", status: "open" });
    mocks.updateStatus.mockResolvedValueOnce(null);
    const response = await updateCase(
      new NextRequest(`https://nexus.test/api/support/${caseId}`, {
        method: "PATCH",
        headers: supportHeaders,
        body: JSON.stringify({ status: "closed", expectedStatus: "open" }),
      }),
      params,
    );
    expect(response.status).toBe(409);
    expectPrivate(response);
    expect((await response.json()).code).toBe("SUPPORT_STATUS_CONFLICT");
    expect(mocks.updateStatus).toHaveBeenCalledWith(caseId, "closed", expect.any(Object), "open");
    expect(afterMock).not.toHaveBeenCalled();
  });
});

describe("durable support request replays", () => {
  it("returns an earlier creation without consuming another limit or notifying twice", async () => {
    mocks.session.mockResolvedValue({ id: "usr_member", role: "user" });
    mocks.findMutationReplay.mockResolvedValueOnce({
      kind: "replayed",
      supportCase: {
        id: caseId,
        category: "account",
        subject: "Account access problem",
        status: "closed",
      },
    });
    const response = await createCase(
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
    expect(response.status).toBe(201);
    expectPrivate(response);
    expect(await response.json()).toMatchObject({
      replayed: true,
      supportCase: { id: caseId, status: "closed" },
    });
    expect(mocks.rate).not.toHaveBeenCalled();
    expect(mocks.createIdempotentCase).not.toHaveBeenCalled();
    expect(afterMock).not.toHaveBeenCalled();
  });

  it("replays a committed reply even after staff closes the case", async () => {
    mocks.session.mockResolvedValue({ id: "usr_member", role: "user" });
    mocks.findById.mockResolvedValue({
      id: caseId,
      requesterId: "usr_member",
      subject: "Account help",
      status: "closed",
    });
    mocks.findMutationReplay.mockResolvedValueOnce({
      kind: "replayed",
      supportCase: { id: caseId, category: "account", subject: "Account help", status: "closed" },
      message: {
        id: `spm_${"a".repeat(24)}`,
        caseId,
        body: "Already committed.",
        authorRole: "requester",
      },
    });
    const response = await addMessage(
      new NextRequest(`https://nexus.test/api/support/${caseId}`, {
        method: "POST",
        headers: supportHeaders,
        body: JSON.stringify({ message: "Already committed.", expectedStatus: "open" }),
      }),
      params,
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      replayed: true,
      supportCase: { status: "closed" },
    });
    expect(mocks.addIdempotentMessage).not.toHaveBeenCalled();
    expect(mocks.rate).not.toHaveBeenCalled();
    expect(afterMock).not.toHaveBeenCalled();
  });

  it("rejects reused keys for different payloads without writes", async () => {
    mocks.session.mockResolvedValue({ id: "usr_member", role: "user" });
    mocks.findMutationReplay.mockResolvedValueOnce({ kind: "key_conflict" });
    const response = await createCase(
      new NextRequest("https://nexus.test/api/support", {
        method: "POST",
        headers: supportHeaders,
        body: JSON.stringify({
          category: "account",
          subject: "Different",
          message: "A different request with the same key.",
        }),
      }),
    );
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("SUPPORT_IDEMPOTENCY_CONFLICT");
    expect(mocks.createIdempotentCase).not.toHaveBeenCalled();
    expect(afterMock).not.toHaveBeenCalled();
  });

  it("handles a concurrent creation winner without a second notification", async () => {
    mocks.session.mockResolvedValue({ id: "usr_member", role: "user" });
    mocks.createIdempotentCase.mockResolvedValueOnce({
      kind: "replayed",
      supportCase: { id: caseId, category: "account", subject: "New case", status: "open" },
    });
    const response = await createCase(
      new NextRequest("https://nexus.test/api/support", {
        method: "POST",
        headers: supportHeaders,
        body: JSON.stringify({
          category: "account",
          subject: "New case",
          message: "Two identical concurrent requests.",
        }),
      }),
    );
    expect(response.status).toBe(201);
    expect((await response.json()).replayed).toBe(true);
    expect(afterMock).not.toHaveBeenCalled();
  });

  it("rejects missing request keys before any write", async () => {
    mocks.session.mockResolvedValue({ id: "usr_member", role: "user" });
    const response = await createCase(
      new NextRequest("https://nexus.test/api/support", {
        method: "POST",
        headers: { ...browserMutationHeaders(), "content-type": "application/json" },
        body: JSON.stringify({
          category: "account",
          subject: "Missing key",
          message: "A key is mandatory to avoid duplicate cases.",
        }),
      }),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("SUPPORT_IDEMPOTENCY_KEY_INVALID");
    expect(mocks.createIdempotentCase).not.toHaveBeenCalled();
    expect(mocks.findMutationReplay).not.toHaveBeenCalled();
  });
});

describe("support requester workspace lifecycle", () => {
  it("applies requester search and status/category filters inside the authenticated scope", async () => {
    mocks.session.mockResolvedValue({ id: "usr_member", role: "user" });
    const response = await listCases(
      new NextRequest(
        "https://nexus.test/api/support?q=Access&status=resolved&category=account&page=2",
      ),
    );
    expect(response.status).toBe(200);
    expect(mocks.pageByRequester).toHaveBeenCalledWith("usr_member", 2, 25, {
      query: "Access",
      status: "resolved",
      category: "account",
    });
    expect(mocks.pageStaff).not.toHaveBeenCalled();
  });
  it.each(["resolved", "open"])(
    "allows own revision-aware transition to %s and delegates live checks to persistence",
    async (status) => {
      mocks.session.mockResolvedValue({ id: "usr_member", role: "user" });
      const from = status === "open" ? "resolved" : "open",
        version = "2026-10-11T00:00:00.000Z";
      mocks.findById.mockResolvedValue({ id: caseId, requesterId: "usr_member", status: from });
      mocks.updateStatus.mockResolvedValue({ id: caseId, status });
      const response = await updateCase(
        new NextRequest(`https://nexus.test/api/support/${caseId}`, {
          method: "PATCH",
          headers: supportHeaders,
          body: JSON.stringify({ status, expectedStatus: from, expectedUpdatedAt: version }),
        }),
        params,
      );
      expect(response.status).toBe(200);
      expect(mocks.updateStatus).toHaveBeenCalledWith(
        caseId,
        status,
        expect.objectContaining({ actorId: "usr_member", actorType: "user" }),
        from,
        new Date(version),
      );
      expect(afterMock).not.toHaveBeenCalled();
    },
  );
  it("forbids requester closure and reopening a staff-closed case", async () => {
    mocks.session.mockResolvedValue({ id: "usr_member", role: "user" });
    for (const [from, status] of [
      ["open", "closed"],
      ["closed", "open"],
    ]) {
      mocks.findById.mockResolvedValue({ id: caseId, requesterId: "usr_member", status: from });
      expect(
        (
          await updateCase(
            new NextRequest(`https://nexus.test/api/support/${caseId}`, {
              method: "PATCH",
              headers: supportHeaders,
              body: JSON.stringify({
                status,
                expectedStatus: from,
                expectedUpdatedAt: "2026-10-11T00:00:00.000Z",
              }),
            }),
            params,
          )
        ).status,
      ).toBe(403);
    }
    expect(mocks.updateStatus).not.toHaveBeenCalled();
  });
  it("blocks cross-site writes and non-JSON media before creation", async () => {
    mocks.session.mockResolvedValue({ id: "usr_member", role: "user" });
    for (const [headers, status] of [
      [{ ...supportHeaders, "sec-fetch-site": "cross-site" }, 403],
      [{ ...supportHeaders, "content-type": "text/plain" }, 415],
    ] as const) {
      expect(
        (
          await createCase(
            new NextRequest("https://nexus.test/api/support", {
              method: "POST",
              headers,
              body: JSON.stringify({
                category: "account",
                subject: "Access problem",
                message: "Please help restore access",
              }),
            }),
          )
        ).status,
      ).toBe(status);
    }
    expect(mocks.createIdempotentCase).not.toHaveBeenCalled();
  });
});
