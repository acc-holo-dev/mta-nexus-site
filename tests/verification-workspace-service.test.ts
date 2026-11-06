import { AppError, type User } from "@nexus/domain";
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
it("uses explicit private DTOs even if storage grows extra account/reviewer fields", async () => {
  mocks.profile.mockResolvedValue({
    id: "actor",
    username: "dev",
    name: "Dev",
    role: "developer",
    identityVerified: true,
    experienceVerified: null,
    hasSpecialties: true,
    identityPending: false,
    experiencePending: false,
    email: "PRIVATE",
    passwordHash: "PRIVATE",
  });
  mocks.history.mockResolvedValue({
    items: [
      {
        id: "request",
        targetType: "developer",
        targetId: "actor",
        status: "rejected",
        proofUrl: "javascript:alert(1)",
        notes: "Evidence",
        reviewNotes: "Feedback",
        createdAt: time,
        resolvedAt: time,
        reviewerId: "PRIVATE",
        requesterId: "PRIVATE",
      },
    ],
    page: 2,
    view: "history",
    hasMore: false,
  });
  const result = await service.overview(actor, {
    page: 2,
    view: "history",
    type: "developer",
    query: "",
  });
  expect(result.profile).toMatchObject({ identityVerified: true, experienceVerified: false });
  expect(result.history.items[0]).toMatchObject({ proofUrl: null, resolvedAt: time.toISOString() });
  expect(JSON.stringify(result)).not.toContain("PRIVATE");
  expect(mocks.history).toHaveBeenCalledWith("actor", expect.objectContaining({ page: 2 }));
});
it("publishes skills and genuine experience only, never historical/default commercial scores", async () => {
  mocks.publicProfile.mockResolvedValue({
    specialties: Array(15).fill("Lua"),
    githubUrl: "https://secret:password@example.test",
    discordTag: "contact",
    verifiedDeveloper: false,
    reputationScore: 100,
    completedDealsCount: 10,
    email: "PRIVATE",
  });
  expect(await service.publicProfile("actor")).toEqual({
    specialties: Array(12).fill("Lua"),
    githubUrl: null,
    discordTag: "contact",
    verifiedDeveloper: false,
  });
});
it("sends a shared profile version and server-owned actor/audit identifiers to storage", async () => {
  mocks.update.mockResolvedValue({
    id: "actor",
    specialties: ["Lua"],
    githubUrl: "https://example.test",
    discordTag: "contact",
    verifiedDeveloper: false,
    updatedAt: time,
    email: "PRIVATE",
  });
  const result = await service.updateProfile(
    actor,
    {
      specialties: ["Lua"],
      githubUrl: "https://example.test/",
      discordTag: "contact",
      expectedUpdatedAt: time.toISOString(),
      expectedActorId: "actor",
    },
    "session-token",
  );
  expect(mocks.update).toHaveBeenCalledWith(
    expect.objectContaining({
      actorId: "actor",
      currentToken: "session-token",
      expectedUpdatedAt: time,
      profileId: expect.any(String),
      auditId: expect.any(String),
    }),
  );
  expect(result.githubUrl).toBe("https://example.test/");
  expect(JSON.stringify(result)).not.toContain("PRIVATE");
});

it("rejects a changed signed-in actor before storage even when profile revisions match", async () => {
  await expect(
    service.updateProfile(
      { ...actor, id: "different-account" },
      {
        specialties: ["Lua"],
        githubUrl: "",
        discordTag: "",
        expectedUpdatedAt: time.toISOString(),
        expectedActorId: "actor",
      },
      "other-session",
    ),
  ).rejects.toMatchObject({ code: "ACCOUNT_CHANGED", statusCode: 409 });
  expect(mocks.update).not.toHaveBeenCalled();
});
it("refuses forged self targets before creating a request and reports duplicate application conflicts", async () => {
  const input = {
    targetType: "developer" as const,
    targetId: "victim",
    proofUrl: "https://example.test/",
    notes: "My evidence",
  };
  await expect(service.apply(actor, input, "token")).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(mocks.createRequest).not.toHaveBeenCalled();
  mocks.createRequest.mockRejectedValue(new AppError("duplicate", 409, "CONFLICT"));
  await expect(
    service.apply(actor, { ...input, targetId: "actor" }, "token"),
  ).rejects.toMatchObject({
    code: "VERIFICATION_PENDING",
  });
  mocks.createRequest.mockRejectedValueOnce({ cause: { code: "40P01" } });
  await expect(
    service.apply(actor, { ...input, targetId: "actor" }, "token"),
  ).rejects.toMatchObject({
    code: "VERIFICATION_RETRY",
    statusCode: 409,
  });
});

it("passes the initiating session to the transactional application", async () => {
  mocks.createRequest.mockResolvedValueOnce({
    id: "ver_1",
    targetType: "user",
    targetId: "actor",
    status: "pending",
  });
  const input = { targetType: "user" as const, targetId: "actor", proofUrl: "", notes: "" };
  await expect(service.apply(actor, input, "current-session")).resolves.toMatchObject({
    id: "ver_1",
  });
  expect(mocks.createRequest).toHaveBeenCalledWith(
    expect.objectContaining({ requesterId: "actor", currentToken: "current-session" }),
    expect.objectContaining({ actorId: "actor" }),
  );
});
