import { NextRequest } from "next/server";
import { expect, it, vi } from "vitest";

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

import { POST as addMessage, PATCH as updateCase } from "../site/src/app/api/support/[id]/route";
import { POST as createCase } from "../site/src/app/api/support/route";
import {
  installSupportRouteLifecycle,
  supportCaseId,
  supportMutationHeaders,
  supportRouteMocks,
  supportRouteParams,
} from "./helpers/support-route-harness";

const caseId = supportCaseId;
const params = supportRouteParams;
const supportHeaders = supportMutationHeaders;
const mocks = supportRouteMocks;

installSupportRouteLifecycle();

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
