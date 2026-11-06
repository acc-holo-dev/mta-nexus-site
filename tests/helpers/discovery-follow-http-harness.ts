import { NextRequest } from "next/server";
import { afterEach, beforeEach, vi } from "vitest";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "../browser-mutation-headers";

/** Shared mutable discovery/follow HTTP fixtures (not vi.hoisted). */
export const discoveryFollowHttpState = {
  actor: { id: "actor", username: "member" } as { id: string; username: string } | null,
  callbacks: [] as (() => Promise<unknown>)[],
};

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

export function discoveryFollowHttpRequest(
  path: string,
  method = "GET",
  body?: unknown,
  locale = "en",
  headers = {},
) {
  return new NextRequest(`http://nexus.test${path}`, {
    method,
    headers: {
      ...browserMutationHeaders(),
      cookie: `nexus_session=test;nexus_locale=${locale}`,
      "content-type": "application/json",
      ...headers,
    },
    ...(body === undefined
      ? {}
      : {
          body: JSON.stringify(
            path === "/api/follow" && body && typeof body === "object" && !Array.isArray(body)
              ? { expectedActorId: "actor", ...body }
              : body,
          ),
        }),
  });
}

function resetDiscoveryFollowHttp() {
  vi.clearAllMocks();
  stubBrowserMutationOrigin();
  const state = discoveryFollowHttpState;
  const mocks = discoveryFollowHttpMocks;
  state.actor = { id: "actor", username: "member" };
  state.callbacks = [];
  mocks.rate.mockResolvedValue({ success: true });
  mocks.discover.mockResolvedValue({ type: "servers", items: [], page: 2, hasMore: false });
  mocks.follows.mockResolvedValue({ items: [], hasMore: false, nextCursor: null });
  mocks.isFollowing.mockResolvedValue(true);
  mocks.states.mockResolvedValue(["publication"]);
  mocks.contentStates.mockResolvedValue([
    { targetId: "publication", notifyComments: true, mutedUntil: null },
  ]);
  mocks.muteState.mockResolvedValue({ muted: false, mutedUntil: null });
  mocks.setFollowing.mockImplementation(
    async (_actor, _type, _id, value, _folId, options = {}) => ({
      following: value,
      created: value,
      notifyComments: value ? (options.notifyComments ?? true) : false,
    }),
  );
}

/** Register shared lifecycle for discovery-follow HTTP suites. */
export function installDiscoveryFollowHttpLifecycle() {
  beforeEach(resetDiscoveryFollowHttp);
  afterEach(() => {
    vi.unstubAllEnvs();
  });
}
