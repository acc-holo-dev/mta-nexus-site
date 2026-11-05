import { beforeEach, type Mock, vi } from "vitest";

export type DiscoverySearchBehaviorSources = {
  products: Mock;
  servers: Mock;
  articles: Mock;
  developers: Mock;
  organizations: Mock;
  directory: Mock;
  rateLimit: Mock;
};

/** Shared repository/service mocks for discovery search behavior suites. */
export const sources: DiscoverySearchBehaviorSources = {
  products: vi.fn(),
  servers: vi.fn(),
  articles: vi.fn(),
  developers: vi.fn(),
  organizations: vi.fn(),
  directory: vi.fn(),
  rateLimit: vi.fn(),
};

export function resetDiscoverySearchBehavior() {
  for (const source of Object.values(sources)) source.mockReset();
  for (const source of [
    sources.products,
    sources.servers,
    sources.articles,
    sources.developers,
    sources.organizations,
  ])
    source.mockResolvedValue([]);
  sources.directory.mockResolvedValue([]);
  sources.rateLimit.mockResolvedValue({ success: true });
}

export function setupDiscoverySearchBehavior() {
  beforeEach(resetDiscoverySearchBehavior);
}
