import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { browserMutationHeaders } from "./browser-mutation-headers";

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

import { POST as addMessage } from "../site/src/app/api/support/[id]/route";
import { POST as createCase } from "../site/src/app/api/support/route";
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
        headers: {
          ...browserMutationHeaders(),
          cookie: supportHeaders.cookie,
          "x-nexus-actor-id": "usr_member",
          "content-type": "application/json",
        },
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
