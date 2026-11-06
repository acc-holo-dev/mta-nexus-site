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

import { POST as createCase } from "../apps/web/src/app/api/support/route";
import {
  expectSupportPrivate,
  installSupportRouteCaseWritesHooks,
  supportCaseId,
  supportMutationHeaders,
  supportRouteMocks,
} from "./helpers/support-route-case-writes-harness";

const caseId = supportCaseId;
const supportHeaders = supportMutationHeaders;
const mocks = supportRouteMocks;
const expectPrivate = expectSupportPrivate;

installSupportRouteCaseWritesHooks();

describe("support HTTP case writes (create)", () => {
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
});
