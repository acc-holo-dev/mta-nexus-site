import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listByTypes: vi.fn(),
}));

vi.mock("@nexus/db", () => ({
  contentRepository: {
    listPublishedByTypes: mocks.listByTypes,
  },
  productRepository: {},
  serverRepository: {},
}));
vi.mock("@nexus/security", () => ({
  can: vi.fn(),
  generateId: vi.fn(),
}));

import { ContentService } from "../apps/web/src/lib/services/content-service";

describe("content feed separation behavior", () => {
  const service = new ContentService();
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listByTypes.mockResolvedValue([]);
  });

  it("queries only editorial types for article feeds", async () => {
    await service.listArticles(12);
    expect(mocks.listByTypes).toHaveBeenCalledWith(
      ["article", "news", "devlog", "update", "announcement"],
      12,
    );
  });

  it("queries only post/question for community topics", async () => {
    await service.listCommunityTopics(18);
    expect(mocks.listByTypes).toHaveBeenCalledWith(
      ["post", "question"],
      18,
    );
  });
});
