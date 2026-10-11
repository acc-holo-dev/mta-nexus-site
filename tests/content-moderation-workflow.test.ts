import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Content, User } from "@nexus/domain";

const mocks = vi.hoisted(() => ({
  findById: vi.fn(),
  moderate: vi.fn(),
  can: vi.fn(),
}));

vi.mock("@nexus/db", () => ({
  contentRepository: {
    findById: mocks.findById,
    moderateStatusWithAudit: mocks.moderate,
    listPublishedByTypes: vi.fn(),
    searchPublishedByTypes: vi.fn(),
    listPublishedByServer: vi.fn(),
    findPublishedBySlug: vi.fn(),
    listComments: vi.fn(),
  },
  productRepository: { list: vi.fn() },
  serverRepository: { listActivePublic: vi.fn() },
}));

vi.mock("@nexus/security", () => ({
  can: mocks.can,
  generateId: vi.fn((prefix: string) => `${prefix}_test`),
}));

import { ContentService } from "../apps/web/src/lib/services/content-service";

const moderator = {
  id: "usr_mod",
  username: "moderator",
  displayName: "Moderator",
  role: "moderator",
} as User;

function content(status: Content["status"]): Content {
  return {
    id: "cnt_1",
    authorId: "usr_author",
    title: "Article",
    slug: "article",
    body: "Article body",
    type: "article",
    tags: [],
    status,
    viewCount: 0,
    likeCount: 0,
    commentCount: 0,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  } as Content;
}

describe("content moderation behavior", () => {
  const service = new ContentService();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.can.mockReturnValue(true);
    mocks.findById.mockResolvedValue(content("draft"));
    mocks.moderate.mockResolvedValue(content("published"));
  });

  it("requires moderator permission before content lookup", async () => {
    mocks.can.mockReturnValue(false);
    await expect(
      service.moderateContent("cnt_1", "publish", moderator, "Reviewed"),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(mocks.findById).not.toHaveBeenCalled();
  });

  it("rejects a repeated transition to the same state", async () => {
    mocks.findById.mockResolvedValue(content("published"));
    await expect(
      service.moderateContent("cnt_1", "publish", moderator, "Replay"),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "CONTENT_ALREADY_IN_STATE",
    });
    expect(mocks.moderate).not.toHaveBeenCalled();
  });

  it("publishes with expected-state compare-and-set and an audit decision", async () => {
    const updated = content("published");
    mocks.moderate.mockResolvedValue(updated);

    await expect(
      service.moderateContent("cnt_1", "publish", moderator, "Reviewed"),
    ).resolves.toBe(updated);
    expect(mocks.moderate).toHaveBeenCalledWith(
      "cnt_1",
      "published",
      "draft",
      expect.objectContaining({
        action: "content.published",
        details: { from: "draft", to: "published", notes: "Reviewed" },
      }),
      new Date("2026-01-01T00:00:00.000Z"),
    );
  });

  it("archives from the current state with the archive audit action", async () => {
    mocks.findById.mockResolvedValue(content("published"));
    const updated = content("archived");
    mocks.moderate.mockResolvedValue(updated);

    await expect(
      service.moderateContent("cnt_1", "archive", moderator, "Retired"),
    ).resolves.toBe(updated);
    expect(mocks.moderate).toHaveBeenCalledWith(
      "cnt_1",
      "archived",
      "published",
      expect.objectContaining({ action: "content.archived" }),
      new Date("2026-01-01T00:00:00.000Z"),
    );
  });

  it("maps a lost compare-and-set to CONTENT_STATE_CHANGED", async () => {
    mocks.moderate.mockResolvedValue(null);
    await expect(
      service.moderateContent("cnt_1", "publish", moderator, "Reviewed"),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "CONTENT_STATE_CHANGED",
    });
  });
  it("rejects a changed reviewed revision before persistence or notifications", async () => {
    await expect(service.moderateContent("cnt_1", "publish", moderator, "Reviewed", new Date("2026-01-01T00:00:00.001Z"))).rejects.toMatchObject({ code: "CONTENT_STATE_CHANGED" });
    expect(mocks.moderate).not.toHaveBeenCalled();
  });
});
