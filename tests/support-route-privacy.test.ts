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

import { GET as getCase } from "../site/src/app/api/support/[id]/route";
import { GET as listCases } from "../site/src/app/api/support/route";
import {
  expectSupportPrivate,
  installSupportRouteLifecycle,
  supportCaseId,
  supportPrivateGet,
  supportRouteMocks,
  supportRouteParams,
} from "./helpers/support-route-harness";

const caseId = supportCaseId;
const params = supportRouteParams;
const mocks = supportRouteMocks;
const expectPrivate = expectSupportPrivate;
const privateGet = supportPrivateGet;

installSupportRouteLifecycle();

describe("support HTTP privacy", () => {
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
});
