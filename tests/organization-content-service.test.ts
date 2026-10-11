import { beforeEach, expect, it, vi } from "vitest";
import type { User } from "@nexus/domain";
const mocks = vi.hoisted(() => ({ create: vi.fn(), mutate: vi.fn(), personal: vi.fn() }));
vi.mock("@nexus/db", () => ({
  organizationContentRepository: { create: mocks.create },
  authorContentRepository: { mutate: mocks.mutate },
  contentRepository: { createWithAudit: mocks.personal },
}));
vi.mock("@nexus/security", () => ({ generateId: (prefix: string) => `${prefix}_generated` }));
import { organizationContentService as service } from "../apps/web/src/lib/services/organization-content-service";
const actor = { id: "editor" } as User;
const input = {
  title: " Team publication ",
  slug: "team-publication",
  body: " A useful publication body ",
  type: "article",
  tags: ["Lua"],
  excerpt: "",
  coverImageUrl: "",
};
const row = {
  ...input,
  id: "content",
  authorId: "original",
  organizationId: "org",
  status: "draft",
  createdAt: new Date(),
  updatedAt: new Date("2026-10-11T00:00:00Z"),
  viewCount: 3,
  likeCount: 2,
  commentCount: 1,
};
const expected = { expectedUpdatedAt: row.updatedAt.toISOString(), expectedStatus: "draft" };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.create.mockResolvedValue(row);
  mocks.mutate.mockResolvedValue(row);
});
it("creates a normalized draft using trusted actor and organization scope and returns only editable fields", async () => {
  const saved = await service.create("org", actor, input);
  expect(mocks.create).toHaveBeenCalledWith(
    "org",
    "editor",
    expect.objectContaining({
      authorId: "editor",
      organizationId: "org",
      status: "draft",
      title: "Team publication",
      body: "A useful publication body",
    }),
    expect.objectContaining({
      action: "content.created_by_organization",
      details: { organizationId: "org", status: "draft", type: "article" },
    }),
  );
  expect(saved).toMatchObject({
    id: "content",
    authorId: "original",
    organizationId: "org",
    updatedAt: expected.expectedUpdatedAt,
  });
  expect(saved).not.toHaveProperty("viewCount");
  expect(mocks.personal).not.toHaveBeenCalled();
});
it.each(["post", "question"])(
  "publishes community type %s immediately using existing policy",
  async (type) => {
    await service.create("org", actor, { ...input, type });
    expect(mocks.create.mock.calls[0][2]).toMatchObject({
      status: "published",
      publishedAt: expect.any(Date),
    });
  },
);
it.each(["authorId", "organizationId", "status", "productId"])(
  "rejects injected publication authority %s",
  async (key) => {
    await expect(
      service.create("org", actor, { ...input, [key]: "injected" }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(mocks.create).not.toHaveBeenCalled();
  },
);
it("uses the same versioned mutation for cross-author editing and archiving with trusted team scope", async () => {
  const { type: _type, slug: _slug, ...fields } = input;
  await service.update("org", actor, "content", { ...fields, ...expected });
  expect(mocks.mutate).toHaveBeenCalledWith(
    "content",
    "editor",
    row.updatedAt,
    "draft",
    expect.objectContaining({ title: "Team publication" }),
    expect.objectContaining({
      action: "content.edited_by_organization",
      details: { organizationId: "org" },
    }),
    "org",
  );
  await service.update("org", actor, "content", expected, true);
  expect(mocks.mutate).toHaveBeenLastCalledWith(
    "content",
    "editor",
    row.updatedAt,
    "draft",
    null,
    expect.objectContaining({ action: "content.archived_by_organization" }),
    "org",
  );
});
it("maps duplicate slugs but preserves live authorization failures", async () => {
  mocks.create.mockRejectedValue({ cause: { code: "23505" } });
  await expect(service.create("org", actor, input)).rejects.toMatchObject({
    code: "SLUG_CONFLICT",
  });
  mocks.create.mockRejectedValue({ code: "FORBIDDEN" });
  await expect(service.create("org", actor, input)).rejects.toMatchObject({ code: "FORBIDDEN" });
});
