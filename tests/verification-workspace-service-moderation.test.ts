import { type User } from "@nexus/domain";
import { expect, it, vi } from "vitest";

vi.mock("@nexus/db", async () => {
  const { createVerificationWorkspaceServiceDbMock } = await import(
    "./helpers/verification-workspace-service-harness"
  );
  return createVerificationWorkspaceServiceDbMock();
});

import { verificationWorkspaceService as service } from "../apps/web/src/lib/services/verification-workspace-service";
import {
  installVerificationWorkspaceServiceHooks,
  verificationWorkspaceServiceMocks as mocks,
} from "./helpers/verification-workspace-service-harness";

installVerificationWorkspaceServiceHooks();

const actor = { id: "actor", role: "developer" } as User,
  time = new Date("2026-10-10T00:00:00Z");
it("gates moderation in the service and propagates pending-state conflicts without false confirmations", async () => {
  await expect(
    service.decide(
      actor,
      "request",
      { decision: "approved", reviewNotes: "Reviewed" },
      "staff-token",
    ),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(mocks.resolveRequest).not.toHaveBeenCalled();
  mocks.resolveRequest.mockResolvedValue(null);
  await expect(
    service.decide(
      { ...actor, role: "moderator" },
      "request",
      {
        decision: "approved",
        reviewNotes: "Reviewed",
      },
      "staff-token",
    ),
  ).rejects.toMatchObject({ code: "VERIFICATION_STATE_CHANGED" });
  mocks.resolveRequest.mockResolvedValue({
    id: "request",
    status: "approved",
    requesterId: "PRIVATE",
  });
  expect(
    await service.decide(
      { ...actor, role: "moderator" },
      "request",
      {
        decision: "approved",
        reviewNotes: "Reviewed",
      },
      "staff-token",
    ),
  ).toEqual({ id: "request", status: "approved" });
  expect(mocks.resolveRequest).toHaveBeenLastCalledWith(
    expect.objectContaining({
      id: "request",
      reviewerId: "actor",
      decision: "approved",
      currentToken: "staff-token",
    }),
    expect.objectContaining({ actorId: "actor", action: "verification.approved" }),
  );
});
it("keeps application detail and event DTOs private and sanitizes proof links", async () => {
  mocks.application.mockResolvedValue({
    row: {
      id: "request",
      targetType: "developer",
      targetId: "PRIVATE",
      status: "pending",
      proofUrl: "javascript:alert(1)",
      notes: "Evidence",
      reviewNotes: "Feedback",
      truncated: false,
      createdAt: time.toISOString(),
      resolvedAt: null,
      eventId: "PRIVATE",
      submittedProfileRevision: "PRIVATE",
      requesterId: "PRIVATE",
      reviewerId: "PRIVATE",
    },
    revision: "a".repeat(64),
    profileState: "changed",
    events: [
      {
        id: "audit",
        action: "verification.application_updated",
        createdAt: time.toISOString(),
        actorId: "PRIVATE",
        details: { notes: "PRIVATE" },
      },
    ],
    hasEarlierEvents: false,
  });
  const result = await service.application(actor, "request");
  expect(result).toMatchObject({ editable: true, proofUrl: null, profileState: "changed" });
  expect(JSON.stringify(result)).not.toContain("PRIVATE");
  expect(mocks.application).toHaveBeenCalledWith("actor", "request");
});
it("validates own amendment before storage and owns all authority and audit fields", async () => {
  const input = {
    expectedRevision: "a".repeat(64),
    proofUrl: "https://example.test/proof",
    notes: "Updated evidence",
  };
  await expect(
    service.amend(actor, "request", { ...input, requesterId: "victim" }, "unit-token"),
  ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  expect(mocks.amend).not.toHaveBeenCalled();
  await expect(service.amend(actor, "../../victim", input, "unit-token")).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  await service.amend(actor, "request", input, "unit-token");
  expect(mocks.amend).toHaveBeenCalledWith(
    "actor",
    "request",
    input,
    expect.objectContaining({
      id: expect.any(String),
      actorId: "actor",
      actorType: "user",
      action: "verification.application_updated",
      targetId: "request",
      targetType: "verification",
    }),
    "unit-token",
  );
});
it("returns only own bounded history summaries and passes filters with actor scope", async () => {
  const filters = {
    query: "word",
    type: "developer" as const,
    status: "pending" as const,
    cursor: undefined,
  };
  mocks.applications.mockResolvedValue({
    items: [
      {
        id: "request",
        targetType: "developer",
        status: "pending",
        notes: "Excerpt",
        createdAt: time.toISOString(),
        resolvedAt: time,
        proofUrl: "PRIVATE",
        reviewerId: "PRIVATE",
      },
    ],
    olderCursor: null,
    newerCursor: null,
  });
  expect(JSON.stringify(await service.applications(actor, filters))).not.toContain("PRIVATE");
  expect(mocks.applications).toHaveBeenCalledWith("actor", filters);
});
