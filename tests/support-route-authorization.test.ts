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
  PATCH as updateCase,
} from "../apps/web/src/app/api/support/[id]/route";
import { POST as createCase } from "../apps/web/src/app/api/support/route";
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

describe("support HTTP authorization admission", () => {
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
});
