import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  const { supportRouteAfterMock } = await import("./helpers/support-route-harness");
  return { ...actual, after: supportRouteAfterMock };
});

vi.mock("../site/src/lib/services/auth-service", async () => {
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

vi.mock("../site/src/lib/services/notification-dispatch-service", async () => {
  const { supportRouteMocks } = await import("./helpers/support-route-harness");
  return { dispatchNotificationsBestEffort: supportRouteMocks.dispatch };
});

import { PATCH as updateCase } from "../site/src/app/api/support/[id]/route";
import { POST as createCase, GET as listCases } from "../site/src/app/api/support/route";
import {
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
const privateGet = supportPrivateGet;

installSupportRouteLifecycle();

describe("support requester workspace lifecycle", () => {
  it("applies requester search and status/category filters inside the authenticated scope", async () => {
    mocks.session.mockResolvedValue({ id: "usr_member", role: "user" });
    const response = await listCases(
      privateGet("https://nexus.test/api/support?q=Access&status=resolved&category=account&page=2"),
    );
    expect(response.status).toBe(200);
    expect(mocks.pageByRequester).toHaveBeenCalledWith(
      "usr_member",
      2,
      25,
      {
        query: "Access",
        status: "resolved",
        category: "account",
      },
      "initiating-token",
    );
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
        "initiating-token",
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
