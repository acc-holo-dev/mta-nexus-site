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

import { PATCH as updateCase } from "../apps/web/src/app/api/support/[id]/route";
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

describe("concurrent support moderation", () => {
  it("requires the last observed status before a staff mutation", async () => {
    mocks.session.mockResolvedValue({ id: "usr_staff", role: "moderator" });
    mocks.can.mockReturnValue(true);
    mocks.findById.mockResolvedValue({ id: caseId, requesterId: "usr_member", status: "open" });

    const response = await updateCase(
      new NextRequest(`https://nexus.test/api/support/${caseId}`, {
        method: "PATCH",
        headers: { ...supportHeaders, "x-nexus-actor-id": "usr_staff" },
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
          headers: { ...supportHeaders, "x-nexus-actor-id": "usr_staff" },
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
        headers: { ...supportHeaders, "x-nexus-actor-id": "usr_staff" },
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
      "initiating-token",
      undefined,
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
        headers: { ...supportHeaders, "x-nexus-actor-id": "usr_staff" },
        body: JSON.stringify({ status: "closed", expectedStatus: "open" }),
      }),
      params,
    );
    expect(response.status).toBe(409);
    expectPrivate(response);
    expect((await response.json()).code).toBe("SUPPORT_STATUS_CONFLICT");
    expect(mocks.updateStatus).toHaveBeenCalledWith(
      caseId,
      "closed",
      expect.any(Object),
      "open",
      "initiating-token",
      undefined,
    );
    expect(afterMock).not.toHaveBeenCalled();
  });
});
