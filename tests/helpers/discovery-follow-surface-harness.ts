import { beforeEach, vi } from "vitest";
import type { FollowPage } from "../../apps/web/src/lib/follow-workspace-contract";

/** Shared discovery/follow service mocks for discovery-follow-surface suites. */
export const discoveryFollowSurfaceMocks = {
  page: vi.fn(),
  directory: vi.fn(),
  viewer: vi.fn(),
  states: vi.fn(),
  muteStates: vi.fn(),
};

function resetDiscoveryFollowSurfaceMocks() {
  vi.clearAllMocks();
  discoveryFollowSurfaceMocks.viewer.mockResolvedValue(null);
  discoveryFollowSurfaceMocks.states.mockResolvedValue([]);
  discoveryFollowSurfaceMocks.muteStates.mockResolvedValue([]);
  discoveryFollowSurfaceMocks.page.mockResolvedValue({
    type: "creators",
    items: [],
    page: 1,
    hasMore: false,
  });
}

/** Register default mock reset for discovery-follow-surface suites. */
export function setupDiscoveryFollowSurface() {
  beforeEach(resetDiscoveryFollowSurfaceMocks);
}

/** Shared follow-workspace list fixture used by workspace/control suites. */
export const followWorkspaceItemBase: FollowPage["items"][number] = {
  id: "f",
  targetType: "organization",
  targetId: "org",
  notifyComments: false,
  createdAt: "2026-10-10T12:00:00.000Z",
  title: "Team",
  description: "Public organization",
  image: null,
  verified: true,
  href: "/organizations/team",
  mutedUntil: null,
};
