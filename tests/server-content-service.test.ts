import { beforeEach, expect, it, vi } from "vitest";
import type { User } from "@nexus/domain";
const mocks = vi.hoisted(() => ({ create: vi.fn(), mutate: vi.fn() }));
vi.mock("@nexus/db", () => ({
  serverContentRepository: { create: mocks.create },
  organizationContentRepository: {},
  authorContentRepository: { mutate: mocks.mutate },
  contentRepository: {},
}));
vi.mock("@nexus/security", () => ({ generateId: (prefix: string) => `${prefix}_generated` }));
import { serverContentService as service } from "../apps/web/src/lib/services/server-content-service";
const actor = { id: "editor" } as User;
const input = {
  title: " Server publication ",
  slug: "server-publication",
  body: " A useful publication body ",
  type: "article",
  tags: ["Lua"],
  excerpt: "",
  coverImageUrl: "",
};
const row = {
  ...input,
  id: "item",
  authorId: "writer",
  serverId: "srv",
  organizationId: "org",
  status: "draft",
  updatedAt: new Date("2026-10-11T00:00:00.000Z"),
  viewCount: 2,
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.create.mockResolvedValue(row);
  mocks.mutate.mockResolvedValue(row);
});
it("creates a normalized editorial draft with trusted server and author and a narrow editable response", async () => {
  const result = await service.create("srv", actor, input);
  expect(mocks.create).toHaveBeenCalledWith(
    "srv",
    "editor",
    expect.objectContaining({
      serverId: "srv",
      authorId: "editor",
      title: "Server publication",
      status: "draft",
    }),
    expect.objectContaining({
      action: "content.created_by_server",
      details: { status: "draft", type: "article", serverId: "srv" },
    }),
  );
  expect(result).toMatchObject({
    serverId: "srv",
    organizationId: "org",
    authorId: "writer",
    updatedAt: row.updatedAt.toISOString(),
  });
  expect(result).not.toHaveProperty("viewCount");
});
it.each(["post", "question", "review"])(
  "rejects non-editorial server creation %s",
  async (type) => {
    await expect(service.create("srv", actor, { ...input, type })).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    expect(mocks.create).not.toHaveBeenCalled();
  },
);
it.each(["serverId", "organizationId", "authorId", "status", "productId"])(
  "rejects injected authority %s",
  async (key) => {
    await expect(
      service.create("srv", actor, { ...input, [key]: "foreign" }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(mocks.create).not.toHaveBeenCalled();
  },
);
it("passes server scope and observed state through the shared editor and archive mutation", async () => {
  const expected = { expectedUpdatedAt: row.updatedAt.toISOString(), expectedStatus: "draft" };
  const { type: _type, slug: _slug, ...fields } = input;
  await service.update("srv", actor, "item", { ...fields, ...expected });
  expect(mocks.mutate).toHaveBeenLastCalledWith(
    "item",
    "editor",
    row.updatedAt,
    "draft",
    expect.objectContaining({ title: "Server publication" }),
    expect.objectContaining({ action: "content.edited_by_server" }),
    undefined,
    "srv",
  );
  await service.update("srv", actor, "item", expected, true);
  expect(mocks.mutate).toHaveBeenLastCalledWith(
    "item",
    "editor",
    row.updatedAt,
    "draft",
    null,
    expect.objectContaining({ action: "content.archived_by_server" }),
    undefined,
    "srv",
  );
});
