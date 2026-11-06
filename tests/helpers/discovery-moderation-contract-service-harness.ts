import type { User } from "@nexus/domain";
import { beforeEach, vi } from "vitest";

/** Shared repository/service mocks for discovery-moderation contract suites. */
export const discoveryModerationContractMocks = {
  servers: vi.fn(),
  creators: vi.fn(),
  organizations: vi.fn(),
  page: vi.fn(),
  detail: vi.fn(),
  command: vi.fn(),
  allowed: vi.fn(),
};

export const discoveryModerationContractTime = "2026-10-11T00:00:00.123456Z";
export const discoveryModerationContractDate = new Date(discoveryModerationContractTime);
export const discoveryModerationContractActor = { id: "actor", role: "moderator" } as User;

export const discoveryModerationContractRow = {
  id: "item",
  slug: "post",
  title: "Post",
  type: "post",
  status: "draft",
  excerpt: "Preview",
  updatedAt: discoveryModerationContractDate,
  createdAt: discoveryModerationContractDate,
  username: "writer",
  name: "Writer",
  avatar: "javascript:bad",
  cursorTime: discoveryModerationContractTime,
  email: "PRIVATE",
  productId: "PRIVATE",
};

export const discoveryModerationContractResult = {
  context: "a".repeat(64),
  hasMore: true,
  nextCursor: { createdAt: discoveryModerationContractTime, id: "last" },
};

function resetDiscoveryModerationContractMocks() {
  vi.clearAllMocks();
  const time = discoveryModerationContractTime;
  const date = discoveryModerationContractDate;
  const row = discoveryModerationContractRow;
  const result = discoveryModerationContractResult;
  discoveryModerationContractMocks.allowed.mockReturnValue(true);
  for (const mock of [
    discoveryModerationContractMocks.servers,
    discoveryModerationContractMocks.creators,
    discoveryModerationContractMocks.organizations,
  ])
    mock.mockResolvedValue({
      items: [],
      page: 1,
      hasMore: true,
      nextCursor: { createdAt: time, id: "last" },
      previousCursor: null,
    });
  discoveryModerationContractMocks.page.mockResolvedValue({ ...result, items: [row] });
  discoveryModerationContractMocks.detail.mockResolvedValue({
    ...result,
    item: {
      ...row,
      body: "Full text",
      truncated: false,
      tags: ["Lua"],
      organizationName: "Team",
      organizationSlug: "team",
      serverName: null,
      serverSlug: null,
      ownerId: "PRIVATE",
    },
    history: [
      {
        id: "event",
        action: "content.published",
        createdAt: date,
        from: "legacy",
        to: "published",
        notes: "Recorded reason",
        ipAddress: "PRIVATE",
        actorId: "PRIVATE",
      },
    ],
  });
  discoveryModerationContractMocks.command.mockResolvedValue({
    id: "item",
    status: "published",
    updatedAt: new Date("2026-10-11T00:00:01Z"),
    body: "PRIVATE",
  });
}

/** Register default mock reset for discovery-moderation contract suites. */
export function setupDiscoveryModerationContract() {
  beforeEach(resetDiscoveryModerationContractMocks);
}
