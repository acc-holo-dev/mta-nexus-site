import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  createWithInitialMessage: vi.fn(),
  addMessage: vi.fn(),
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
    createWithInitialMessage: mocks.createWithInitialMessage,
    addMessage: mocks.addMessage,
    updateStatus: mocks.updateStatus,
  },
  userRepository: { listModeratorIds: mocks.moderatorIds },
}));

vi.mock("../../../lib/services/notification-dispatch-service", () => ({
  dispatchNotificationsBestEffort: mocks.dispatch,
}));

import {
  GET as listCases,
  POST as createCase,
} from "./route";
import {
  GET as getCase,
  PATCH as updateCase,
  POST as addMessage,
} from "./[id]/route";

const caseId = `sup_${"a".repeat(24)}`;
const params = { params: Promise.resolve({ id: caseId }) };

function expectPrivate(response: Response) {
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(response.headers.get("x-request-id")).toBeTruthy();
}

beforeEach(() => {
  vi.clearAllMocks();
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
  mocks.createWithInitialMessage.mockResolvedValue({
    id: caseId,
    requesterId: "usr_member",
    category: "account",
    subject: "Account help",
    status: "open",
  });
  mocks.addMessage.mockResolvedValue({
    supportCase: { id: caseId, status: "open" },
    message: { id: `spm_${"a".repeat(24)}`, authorRole: "requester" },
  });
  mocks.updateStatus.mockResolvedValue({ id: caseId, requesterId: "usr_member", subject: "Account help", status: "resolved" });
  mocks.moderatorIds.mockResolvedValue(["usr_mod"]);
  mocks.dispatch.mockResolvedValue({
    requested: 1,
    stored: 1,
    storageFailed: 0,
    pushQueued: 1,
  });
});

describe("support HTTP authorization and privacy", () => {
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
    expect(mocks.pageStaff).toHaveBeenCalledWith(1, 25, {});
  });

  it("filters authorized staff queues with the same bounded page metadata", async () => {
    mocks.session.mockResolvedValue({ id: "usr_staff", role: "moderator" });
    mocks.can.mockReturnValue(true);
    mocks.pageStaff.mockResolvedValue({ items: [], page: 3, pageSize: 25, total: 53, totalPages: 3 });

    const response = await listCases(new NextRequest(
      "https://nexus.test/api/support?scope=staff&page=3&status=open&category=payment",
    ));
    expect(response.status).toBe(200);
    expectPrivate(response);
    expect(await response.json()).toMatchObject({ page: 3, total: 53, totalPages: 3 });
    expect(mocks.pageStaff).toHaveBeenCalledWith(3, 25, {
      status: "open",
      category: "payment",
    });
    expect(mocks.pageByRequester).not.toHaveBeenCalled();
  });

  it.each([
    "status=under_review",
    "category=invalid",
    "status=",
    "status=open&status=closed",
    "category=account&category=payment",
  ])("rejects invalid staff queue filters: %s", async (query) => {
    mocks.session.mockResolvedValue({ id: "usr_staff", role: "moderator" });
    mocks.can.mockReturnValue(true);
    const response = await listCases(new NextRequest(
      `https://nexus.test/api/support?scope=staff&${query}`,
    ));
    expect(response.status).toBe(400);
    expectPrivate(response);
    expect(mocks.pageStaff).not.toHaveBeenCalled();
    expect(mocks.pageByRequester).not.toHaveBeenCalled();
  });

  it("does not expose another user's thread unless the viewer is staff", async () => {
    mocks.session.mockResolvedValue({ id: "usr_member", role: "user" });
    mocks.findById.mockResolvedValue({
      id: caseId,
      requesterId: "usr_other",
      status: "open",
    });

    const request = new NextRequest(`https://nexus.test/api/support/${caseId}`);
    const hidden = await getCase(request, params);
    expect(hidden.status).toBe(404);
    expectPrivate(hidden);
    expect(mocks.pageMessages).not.toHaveBeenCalled();

    mocks.can.mockReturnValue(true);
    mocks.pageMessages.mockResolvedValue({
      items: [{ id: "spm_1", body: "private" }],
      page: 1,
      pageSize: 100,
      total: 1,
      totalPages: 1,
    });
    const allowed = await getCase(request, params);
    expect(allowed.status).toBe(200);
    expectPrivate(allowed);
    expect(mocks.pageMessages).toHaveBeenCalledWith(caseId, 1);
  });

  it("normalizes invalid page query and exposes bounded page metadata", async () => {
    mocks.session.mockResolvedValue({ id: "usr_member", role: "user" });
    mocks.pageByRequester.mockResolvedValue({
      items: [{ id: caseId }],
      page: 1,
      pageSize: 25,
      total: 51,
      totalPages: 3,
    });

    const response = await listCases(
      new NextRequest("https://nexus.test/api/support?page=0"),
    );
    expect(response.status).toBe(200);
    expect(mocks.pageByRequester).toHaveBeenCalledWith("usr_member", 1);
    expect(await response.json()).toMatchObject({
      page: 1,
      totalPages: 3,
      total: 51,
    });
  });

  it("passes a bounded message page into the repository", async () => {
    mocks.session.mockResolvedValue({ id: "usr_member", role: "user" });
    mocks.findById.mockResolvedValue({
      id: caseId,
      requesterId: "usr_member",
      status: "open",
    });
    mocks.pageMessages.mockResolvedValue({
      items: [],
      page: 7,
      pageSize: 100,
      total: 601,
      totalPages: 7,
    });

    const response = await getCase(
      new NextRequest(
        `https://nexus.test/api/support/${caseId}?messagePage=7`,
      ),
      params,
    );
    expect(response.status).toBe(200);
    expect(mocks.pageMessages).toHaveBeenCalledWith(caseId, 7);
    expect(await response.json()).toMatchObject({
      messagePage: 7,
      messageTotalPages: 7,
      messageTotal: 601,
    });
  });

  it("rejects client-forged related entity context before persistence", async () => {
    mocks.session.mockResolvedValue({ id: "usr_member", role: "user" });
    const response = await createCase(
      new NextRequest("https://nexus.test/api/support", {
        method: "POST",
        headers: { "content-type": "application/json" },
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
    expect(mocks.createWithInitialMessage).not.toHaveBeenCalled();
  });

  it("persists a valid new case with an audit event", async () => {
    mocks.session.mockResolvedValue({ id: "usr_member", role: "user" });
    const response = await createCase(
      new NextRequest("https://nexus.test/api/support", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          category: "account",
          subject: "Account access problem",
          message: "Recovery completed, but I still cannot access my account.",
        }),
      }),
    );

    expect(response.status).toBe(201);
    expectPrivate(response);
    expect(mocks.createWithInitialMessage).toHaveBeenCalledWith(
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
    );
  });

  it("delivers support notifications only after committed mutations", async () => {
    mocks.session.mockResolvedValue({ id: "usr_member", role: "user" });
    const createResponse = await createCase(
      new NextRequest("https://nexus.test/api/support", {
        method: "POST",
        headers: { "content-type": "application/json" },
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
        link: "/admin/support/" + caseId,
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
      new NextRequest("https://nexus.test/api/support/" + caseId, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "We restored the account.", expectedStatus: "open" }),
      }),
      params,
    );
    expect(reply.status).toBe(201);
    expect(mocks.dispatch).not.toHaveBeenCalled();
    await state.afterCallbacks.shift()?.();
    expect(mocks.dispatch).toHaveBeenCalledWith([
      expect.objectContaining({
        recipientId: "usr_member",
        link: "/support/" + caseId,
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
    mocks.updateStatus.mockResolvedValue({
      id: caseId,
      requesterId: "usr_member",
      subject: "Account help",
      status: "resolved",
    });
    const statusResponse = await updateCase(
      new NextRequest("https://nexus.test/api/support/" + caseId, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "resolved", expectedStatus: "open" }),
      }),
      params,
    );
    expect(statusResponse.status).toBe(200);
    expect(mocks.dispatch).not.toHaveBeenCalled();
    await state.afterCallbacks.shift()?.();
    expect(mocks.dispatch).toHaveBeenCalledWith([
      expect.objectContaining({
        recipientId: "usr_member",
        title: "Support case status changed",
      }),
    ]);
  });

  it("keeps status changes staff-only and closed threads immutable to replies", async () => {
    mocks.session.mockResolvedValue({ id: "usr_member", role: "user" });
    mocks.findById.mockResolvedValue({
      id: caseId,
      requesterId: "usr_member",
      status: "open",
    });

    const patchRequest = new NextRequest(
      `https://nexus.test/api/support/${caseId}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "resolved", expectedStatus: "open" }),
      },
    );
    const denied = await updateCase(patchRequest, params);
    expect(denied.status).toBe(403);
    expectPrivate(denied);
    expect(mocks.updateStatus).not.toHaveBeenCalled();

    mocks.addMessage.mockResolvedValueOnce(null);
    mocks.findById.mockResolvedValueOnce({
      id: caseId,
      requesterId: "usr_member",
      status: "closed",
    });
    const reply = await addMessage(
      new NextRequest(`https://nexus.test/api/support/${caseId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
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
    mocks.addMessage.mockResolvedValueOnce(null);

    const response = await addMessage(
      new NextRequest(`https://nexus.test/api/support/${caseId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
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
    expect(mocks.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId,
        expectedStatus: "open",
      }),
      expect.any(Object),
    );
    expect(afterMock).not.toHaveBeenCalled();
  });

  it("requires a client-observed status before accepting replies", async () => {
    mocks.session.mockResolvedValue({ id: "usr_member", role: "user" });
    mocks.findById.mockResolvedValue({
      id: caseId, requesterId: "usr_member", subject: "Account help", status: "open",
    });

    const response = await addMessage(
      new NextRequest(`https://nexus.test/api/support/${caseId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "This request has no state precondition." }),
      }),
      params,
    );
    expect(response.status).toBe(400);
    expectPrivate(response);
    expect(mocks.addMessage).not.toHaveBeenCalled();
    expect(afterMock).not.toHaveBeenCalled();
  });

  it("rejects a reply composed before another moderator resolved the ticket", async () => {
    mocks.session.mockResolvedValue({ id: "usr_member", role: "user" });
    mocks.findById.mockResolvedValue({
      id: caseId, requesterId: "usr_member", subject: "Account help", status: "resolved",
    });
    const response = await addMessage(
      new NextRequest(`https://nexus.test/api/support/${caseId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "I was reading an open thread.", expectedStatus: "open" }),
      }),
      params,
    );
    expect(response.status).toBe(409);
    expectPrivate(response);
    expect(await response.json()).toMatchObject({ code: "SUPPORT_MESSAGE_CONFLICT" });
    expect(mocks.addMessage).not.toHaveBeenCalled();
    expect(afterMock).not.toHaveBeenCalled();
  });

  it("allows a deliberate reply to a resolved ticket, reopening it atomically", async () => {
    mocks.session.mockResolvedValue({ id: "usr_member", role: "user" });
    mocks.findById.mockResolvedValue({
      id: caseId, requesterId: "usr_member", subject: "Account help", status: "resolved",
    });
    const response = await addMessage(
      new NextRequest(`https://nexus.test/api/support/${caseId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "I still need assistance.", expectedStatus: "resolved" }),
      }),
      params,
    );
    expect(response.status).toBe(201);
    expectPrivate(response);
    expect(mocks.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ caseId, expectedStatus: "resolved" }),
      expect.any(Object),
    );
    expect(afterMock).toHaveBeenCalledOnce();
  });

  it("rejects replies to already closed tickets before repository mutation", async () => {
    mocks.session.mockResolvedValue({ id: "usr_member", role: "user" });
    mocks.findById.mockResolvedValue({
      id: caseId, requesterId: "usr_member", subject: "Account help", status: "closed",
    });
    const response = await addMessage(
      new NextRequest(`https://nexus.test/api/support/${caseId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "The ticket is already closed.", expectedStatus: "closed" }),
      }),
      params,
    );
    expect(response.status).toBe(409);
    expectPrivate(response);
    expect(await response.json()).toMatchObject({ code: "SUPPORT_CASE_CLOSED" });
    expect(mocks.addMessage).not.toHaveBeenCalled();
    expect(afterMock).not.toHaveBeenCalled();
  });
});

describe("concurrent support moderation", () => {

  it("requires the last observed status before a staff mutation", async () => {
    mocks.session.mockResolvedValue({ id: "usr_staff", role: "moderator" });
    mocks.can.mockReturnValue(true);
    mocks.findById.mockResolvedValue({ id: caseId, requesterId: "usr_member", status: "open" });

    const response = await updateCase(new NextRequest("https://nexus.test/api/support/" + caseId, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "closed" }),
    }), params);

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
      mocks.findById.mockResolvedValue({ id: caseId, requesterId: "usr_member", status: "resolved" });

      const response = await updateCase(new NextRequest("https://nexus.test/api/support/" + caseId, {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, expectedStatus: "open" }),
      }), params);

      expect(response.status).toBe(409);
      expectPrivate(response);
      expect(await response.json()).toMatchObject({ code: "SUPPORT_STATUS_CONFLICT" });
      expect(mocks.updateStatus).not.toHaveBeenCalled();
      expect(afterMock).not.toHaveBeenCalled();
      expect(mocks.dispatch).not.toHaveBeenCalled();
    },
  );
  it("does not write or notify when the requested status is already current", async () => {
    mocks.session.mockResolvedValue({ id: "usr_staff", role: "moderator" });
    mocks.can.mockReturnValue(true);
    mocks.findById.mockResolvedValue({ id: caseId, requesterId: "usr_member", status: "resolved" });
    const response = await updateCase(new NextRequest("https://nexus.test/api/support/" + caseId, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "resolved", expectedStatus: "resolved" }),
    }), params);
    expect(response.status).toBe(200);
    expect(mocks.updateStatus).not.toHaveBeenCalled();
    expect(afterMock).not.toHaveBeenCalled();
  });

  it("rejects stale status changes without sending notifications", async () => {
    mocks.session.mockResolvedValue({ id: "usr_staff", role: "moderator" });
    mocks.can.mockReturnValue(true);
    mocks.findById.mockResolvedValue({ id: caseId, requesterId: "usr_member", status: "open" });
    mocks.updateStatus.mockResolvedValueOnce(null);
    const response = await updateCase(new NextRequest("https://nexus.test/api/support/" + caseId, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "closed", expectedStatus: "open" }),
    }), params);
    expect(response.status).toBe(409);
    expectPrivate(response);
    expect((await response.json()).code).toBe("SUPPORT_STATUS_CONFLICT");
    expect(mocks.updateStatus).toHaveBeenCalledWith(caseId, "closed", expect.any(Object), "open");
    expect(afterMock).not.toHaveBeenCalled();
  });
});
