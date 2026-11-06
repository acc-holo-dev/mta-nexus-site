import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/server", async () => {
  const { createSupportRouteCaseWritesNextServerMock } = await import(
    "./helpers/support-route-case-writes-harness"
  );
  return createSupportRouteCaseWritesNextServerMock();
});

vi.mock("../apps/web/src/lib/services/auth-service", async () => {
  const { createSupportRouteCaseWritesAuthServiceMock } = await import(
    "./helpers/support-route-case-writes-harness"
  );
  return createSupportRouteCaseWritesAuthServiceMock();
});

vi.mock("@nexus/security", async () => {
  const { createSupportRouteCaseWritesSecurityMock } = await import(
    "./helpers/support-route-case-writes-harness"
  );
  return createSupportRouteCaseWritesSecurityMock();
});

vi.mock("@nexus/db", async () => {
  const { createSupportRouteCaseWritesDbMock } = await import(
    "./helpers/support-route-case-writes-harness"
  );
  return createSupportRouteCaseWritesDbMock();
});

vi.mock("../apps/web/src/lib/services/notification-dispatch-service", async () => {
  const { createSupportRouteCaseWritesNotificationDispatchMock } = await import(
    "./helpers/support-route-case-writes-harness"
  );
  return createSupportRouteCaseWritesNotificationDispatchMock();
});

import {
  POST as addMessage,
  PATCH as updateCase,
} from "../apps/web/src/app/api/support/[id]/route";
import { POST as createCase } from "../apps/web/src/app/api/support/route";
import {
  expectSupportPrivate,
  installSupportRouteCaseWritesHooks,
  supportCaseId,
  supportMutationHeaders,
  supportRouteAfterMock,
  supportRouteMocks,
  supportRouteParams,
  supportRouteState,
} from "./helpers/support-route-case-writes-harness";

const caseId = supportCaseId;
const params = supportRouteParams;
const supportHeaders = supportMutationHeaders;
const mocks = supportRouteMocks;
const afterMock = supportRouteAfterMock;
const expectPrivate = expectSupportPrivate;
const state = supportRouteState;

installSupportRouteCaseWritesHooks();

describe("support HTTP case writes (replies and status)", () => {
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
