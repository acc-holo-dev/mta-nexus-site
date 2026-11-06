import { afterEach, beforeEach, vi } from "vitest";
import { stubBrowserMutationOrigin } from "../browser-mutation-headers";

/** Shared mutable fixtures for discovery-follow HTTP suites. */
export const discoveryFollowHttpState = {
  actor: { id: "actor", username: "member" } as { id: string; username: string } | null,
  callbacks: [] as (() => Promise<unknown>)[],
};

/** Shared service mocks for discovery-follow HTTP suites. */
export const discoveryFollowHttpMocks = {
  discover: vi.fn(),
  follows: vi.fn(),
  setFollowing: vi.fn(),
  isFollowing: vi.fn(),
  states: vi.fn(),
  contentStates: vi.fn(),
  muteState: vi.fn(),
  rate: vi.fn(),
  notifications: vi.fn(),
};

/** Factory for `vi.mock("next/server", …)` from suite files under `tests/`. */
export async function createDiscoveryFollowHttpNextServerMock(
  original: () => Promise<typeof import("next/server")>,
) {
  return {
    ...(await original()),
    after: (fn: () => Promise<unknown>) => discoveryFollowHttpState.callbacks.push(fn),
  };
}

/** Factory for `vi.mock("@nexus/db", …)` from suite files under `tests/`. */
export function createDiscoveryFollowHttpDbMock() {
  return {
    followWorkspaceRepository: {
      setFollowingAuthenticated: discoveryFollowHttpMocks.setFollowing,
      states: discoveryFollowHttpMocks.states,
      contentStates: discoveryFollowHttpMocks.contentStates,
      muteState: discoveryFollowHttpMocks.muteState,
    },
    socialRepository: { isFollowing: discoveryFollowHttpMocks.isFollowing },
  };
}

/** Factory for `vi.mock("@nexus/security", …)` from suite files under `tests/`. */
export function createDiscoveryFollowHttpSecurityMock() {
  return {
    consumeRateLimit: discoveryFollowHttpMocks.rate,
    generateId: () => "generated",
  };
}

/** Factory for auth-service mock from suite files under `tests/`. */
export function createDiscoveryFollowHttpAuthMock() {
  return {
    authService: { getSession: async () => discoveryFollowHttpState.actor },
  };
}

/** Factory for discovery-service mock from suite files under `tests/`. */
export function createDiscoveryFollowHttpDiscoveryMock() {
  return { discoveryService: { page: discoveryFollowHttpMocks.discover } };
}

/** Factory for follow-workspace-service mock from suite files under `tests/`. */
export function createDiscoveryFollowHttpFollowWorkspaceMock() {
  return { followWorkspaceService: { page: discoveryFollowHttpMocks.follows } };
}

/** Factory for notification-dispatch-service mock from suite files under `tests/`. */
export function createDiscoveryFollowHttpNotificationsMock() {
  return { dispatchNotificationsBestEffort: discoveryFollowHttpMocks.notifications };
}

export function installDiscoveryFollowHttpHooks() {
  beforeEach(() => {
    vi.clearAllMocks();
    stubBrowserMutationOrigin();
    discoveryFollowHttpState.actor = { id: "actor", username: "member" };
    discoveryFollowHttpState.callbacks = [];
    discoveryFollowHttpMocks.rate.mockResolvedValue({ success: true });
    discoveryFollowHttpMocks.discover.mockResolvedValue({
      type: "servers",
      items: [],
      page: 2,
      hasMore: false,
    });
    discoveryFollowHttpMocks.follows.mockResolvedValue({
      items: [],
      hasMore: false,
      nextCursor: null,
    });
    discoveryFollowHttpMocks.isFollowing.mockResolvedValue(true);
    discoveryFollowHttpMocks.states.mockResolvedValue(["publication"]);
    discoveryFollowHttpMocks.contentStates.mockResolvedValue([
      { targetId: "publication", notifyComments: true, mutedUntil: null },
    ]);
    discoveryFollowHttpMocks.muteState.mockResolvedValue({ muted: false, mutedUntil: null });
    discoveryFollowHttpMocks.setFollowing.mockImplementation(
      async (_actor, _type, _id, value, _folId, options = {}) => ({
        following: value,
        created: value,
        notifyComments: value ? (options.notifyComments ?? true) : false,
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });
}
