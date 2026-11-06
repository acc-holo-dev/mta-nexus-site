import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

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

import { POST as addMessage } from "../apps/web/src/app/api/support/[id]/route";
import {
  expectSupportPrivate,
  installSupportRouteLifecycle,
  supportCaseId,
  supportMutationHeaders,
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

installSupportRouteLifecycle();

describe("support HTTP case write replies", () => {
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
