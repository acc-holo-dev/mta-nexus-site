import { beforeEach, expect, it, vi } from "vitest";
import { AppError, type User } from "@nexus/domain";
const mocks = vi.hoisted(() => ({
  own: vi.fn(),
  update: vi.fn(),
  publicProfile: vi.fn(),
  profile: vi.fn(),
  history: vi.fn(),
  targets: vi.fn(),
  createRequest: vi.fn(),
  resolveRequest: vi.fn(),
}));
vi.mock("@nexus/db", () => ({
  developerProfileRepository: mocks,
  verificationRepository: mocks,
  verificationWorkspaceRepository: mocks,
}));
import { verificationWorkspaceService as service } from "../apps/web/src/lib/services/verification-workspace-service";
const actor = { id: "actor", role: "developer" } as User,
  time = new Date("2026-10-10T00:00:00Z");
beforeEach(() => {
  vi.clearAllMocks();
});
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
  const result = await service.updateProfile(actor, {
    specialties: ["Lua"],
    githubUrl: "https://example.test/",
    discordTag: "contact",
    expectedUpdatedAt: time.toISOString(),
  });
  expect(mocks.update).toHaveBeenCalledWith(
    expect.objectContaining({
      actorId: "actor",
      expectedUpdatedAt: time,
      profileId: expect.any(String),
      auditId: expect.any(String),
    }),
  );
  expect(result.githubUrl).toBe("https://example.test/");
  expect(JSON.stringify(result)).not.toContain("PRIVATE");
});
it("refuses forged self targets before creating a request and reports duplicate application conflicts", async () => {
  const input = {
    targetType: "developer" as const,
    targetId: "victim",
    proofUrl: "https://example.test/",
    notes: "My evidence",
  };
  await expect(service.apply(actor, input)).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(mocks.createRequest).not.toHaveBeenCalled();
  mocks.createRequest.mockRejectedValue(new AppError("duplicate", 409, "CONFLICT"));
  await expect(service.apply(actor, { ...input, targetId: "actor" })).rejects.toMatchObject({
    code: "VERIFICATION_PENDING",
  });
});
it("gates moderation in the service and propagates pending-state conflicts without false confirmations", async () => {
  await expect(
    service.decide(actor, "request", { decision: "approved", reviewNotes: "Reviewed" }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(mocks.resolveRequest).not.toHaveBeenCalled();
  mocks.resolveRequest.mockResolvedValue(null);
  await expect(
    service.decide({ ...actor, role: "moderator" }, "request", {
      decision: "approved",
      reviewNotes: "Reviewed",
    }),
  ).rejects.toMatchObject({ code: "VERIFICATION_STATE_CHANGED" });
  mocks.resolveRequest.mockResolvedValue({
    id: "request",
    status: "approved",
    requesterId: "PRIVATE",
  });
  expect(
    await service.decide({ ...actor, role: "moderator" }, "request", {
      decision: "approved",
      reviewNotes: "Reviewed",
    }),
  ).toEqual({ id: "request", status: "approved" });
});
