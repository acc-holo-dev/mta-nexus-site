import type { User } from "@nexus/domain";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ own: vi.fn(), visibility: vi.fn(), update: vi.fn() }));
vi.mock("@nexus/db", () => ({ profilePrivacyRepository: mocks }));
vi.mock("@nexus/security", () => ({ generateId: () => "audit" }));

import { profilePrivacyService as service } from "../../src/lib/services/profile-privacy-service";

const actor = { id: "actor" } as User;
const row = {
  id: actor.id,
  username: "member",
  showActivity: false,
  showProfessionalContacts: true,
  updatedAt: new Date("2026-10-10T00:00:00.000Z"),
  email: "private",
  passwordHash: "private",
};
beforeEach(() => vi.clearAllMocks());
it("projects private editable preferences without unrelated account fields", async () => {
  mocks.own.mockResolvedValue(row);
  expect(await service.own(actor)).toEqual({
    id: actor.id,
    username: "member",
    showActivity: false,
    showProfessionalContacts: true,
    updatedAt: row.updatedAt.toISOString(),
  });
  expect(mocks.own).toHaveBeenCalledWith(actor.id);
});
it("rejects a mismatched account before calling the repository", async () => {
  await expect(
    service.update(
      actor,
      {
        expectedActorId: "other",
        showActivity: true,
        showProfessionalContacts: false,
        expectedUpdatedAt: row.updatedAt.toISOString(),
      },
      "test",
    ),
  ).rejects.toMatchObject({ code: "ACCOUNT_CHANGED", statusCode: 409 });
  expect(mocks.update).not.toHaveBeenCalled();
});
it("binds the write to session identity and converts the shared revision without spreading supplied fields", async () => {
  mocks.update.mockResolvedValue(row);
  const fields = {
    showActivity: false,
    showProfessionalContacts: true,
    expectedActorId: actor.id,
    expectedUpdatedAt: row.updatedAt.toISOString(),
    actorId: "victim",
  };
  const result = await service.update(actor, fields, "test");
  expect(mocks.update).toHaveBeenCalledWith({
    actorId: actor.id,
    currentToken: "test",
    showActivity: false,
    showProfessionalContacts: true,
    expectedUpdatedAt: row.updatedAt,
    auditId: "audit",
  });
  expect(result).not.toHaveProperty("email");
});

it("reports a rolled-back deadlock as a retryable conflict", async () => {
  mocks.update.mockRejectedValueOnce({ cause: { code: "40P01" } });
  await expect(
    service.update(
      actor,
      {
        expectedActorId: actor.id,
        expectedUpdatedAt: row.updatedAt.toISOString(),
        showActivity: false,
        showProfessionalContacts: false,
      },
      "test",
    ),
  ).rejects.toMatchObject({ code: "PRIVACY_SAVE_RETRY", statusCode: 409 });
});
it("returns only visibility to public pages and fails closed for a missing account or database failure", async () => {
  mocks.visibility.mockResolvedValue(row);
  expect(await service.visibility("actor")).toEqual({
    showActivity: false,
    showProfessionalContacts: true,
  });
  mocks.visibility.mockResolvedValue(null);
  await expect(service.visibility("missing")).rejects.toMatchObject({ code: "NOT_FOUND" });
  mocks.visibility.mockRejectedValue(new Error("database unavailable"));
  await expect(service.visibility("actor")).rejects.toThrow("database unavailable");
});
