import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  can: vi.fn(),
  rate: vi.fn(),
  listByRequester: vi.fn(),
  listStaff: vi.fn(),
  findById: vi.fn(),
  listMessages: vi.fn(),
  createWithInitialMessage: vi.fn(),
  addMessage: vi.fn(),
  updateStatus: vi.fn(),
}));

vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: mocks.session },
}));

vi.mock("@nexus/security", () => ({
  can: mocks.can,
  consumeRateLimit: mocks.rate,
  generateId: (prefix: string) => `${prefix}_${"a".repeat(24)}`,
}));

vi.mock("@nexus/db", () => ({
  supportCaseRepository: {
    listByRequester: mocks.listByRequester,
    listStaff: mocks.listStaff,
    findById: mocks.findById,
    listMessages: mocks.listMessages,
    createWithInitialMessage: mocks.createWithInitialMessage,
    addMessage: mocks.addMessage,
    updateStatus: mocks.updateStatus,
  },
}));

import {
  GET as listCases,
  POST as createCase,
} from "../apps/web/src/app/api/support/route";
import {
  GET as getCase,
  PATCH as updateCase,
  POST as addMessage,
} from "../apps/web/src/app/api/support/[id]/route";

const caseId = `sup_${"a".repeat(24)}`;
const params = { params: Promise.resolve({ id: caseId }) };

function expectPrivate(response: Response) {
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(response.headers.get("x-request-id")).toBeTruthy();
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue(null);
  mocks.can.mockReturnValue(false);
  mocks.rate.mockResolvedValue({ success: true });
  mocks.listByRequester.mockResolvedValue([]);
  mocks.listStaff.mockResolvedValue([]);
  mocks.findById.mockResolvedValue(null);
  mocks.listMessages.mockResolvedValue([]);
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
  mocks.updateStatus.mockResolvedValue({ id: caseId, status: "resolved" });
});

describe("support HTTP authorization and privacy", () => {
  it("keeps unauthenticated and authenticated case lists private", async () => {
    const request = new NextRequest("https://nexus.test/api/support");
    const denied = await listCases(request);
    expect(denied.status).toBe(401);
    expectPrivate(denied);

    mocks.session.mockResolvedValue({ id: "usr_member", role: "user" });
    mocks.listByRequester.mockResolvedValue([{ id: caseId }]);
    const allowed = await listCases(request);
    expect(allowed.status).toBe(200);
    expectPrivate(allowed);
    expect(mocks.listByRequester).toHaveBeenCalledWith("usr_member");
  });

  it("requires moderation capability for the staff queue", async () => {
    mocks.session.mockResolvedValue({ id: "usr_member", role: "user" });
    const request = new NextRequest("https://nexus.test/api/support?scope=staff");

    const denied = await listCases(request);
    expect(denied.status).toBe(403);
    expectPrivate(denied);
    expect(mocks.listStaff).not.toHaveBeenCalled();

    mocks.can.mockReturnValue(true);
    mocks.listStaff.mockResolvedValue([
      {
        supportCase: { id: caseId, requesterId: "usr_other" },
        requesterUsername: "other",
        requesterDisplayName: "Other",
      },
    ]);
    const allowed = await listCases(request);
    expect(allowed.status).toBe(200);
    expectPrivate(allowed);
    expect(mocks.listStaff).toHaveBeenCalledOnce();
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
    expect(mocks.listMessages).not.toHaveBeenCalled();

    mocks.can.mockReturnValue(true);
    mocks.listMessages.mockResolvedValue([{ id: "spm_1", body: "private" }]);
    const allowed = await getCase(request, params);
    expect(allowed.status).toBe(200);
    expectPrivate(allowed);
    expect(mocks.listMessages).toHaveBeenCalledWith(caseId);
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
        body: JSON.stringify({ status: "resolved" }),
      },
    );
    const denied = await updateCase(patchRequest, params);
    expect(denied.status).toBe(403);
    expectPrivate(denied);
    expect(mocks.updateStatus).not.toHaveBeenCalled();

    mocks.addMessage.mockResolvedValueOnce(null);
    const reply = await addMessage(
      new NextRequest(`https://nexus.test/api/support/${caseId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "Please reopen this issue." }),
      }),
      params,
    );
    expect(reply.status).toBe(409);
    expectPrivate(reply);
  });
});
