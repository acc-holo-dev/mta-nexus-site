import { NextRequest } from "next/server";
import { beforeEach, expect, vi } from "vitest";

type ContextUser = {
  id: string;
  displayName: string;
  activeContextId?: string | null;
};

/** Shared session/rate-limit state for context-switching HTTP suites. */
export const contextSwitchingState = {
  user: {
    id: "usr_context",
    displayName: "Context User",
    activeContextId: "org_owned",
  } as ContextUser | null,
  allowed: true,
};

/** Shared auth/org repository mocks for context-switching HTTP suites. */
export const contextSwitchingMocks = {
  getSession: vi.fn(async () => contextSwitchingState.user),
  getSessionIdentity: vi.fn(async () =>
    contextSwitchingState.user
      ? { user: contextSwitchingState.user, sessionId: "ses_context" }
      : null,
  ),
  switchContext: vi.fn(async (_userId: string, contextId: string) => ({
    ...contextSwitchingState.user,
    activeContextId: contextId,
  })),
  owned: vi.fn(async () => [
    {
      id: "org_owned",
      name: "Owned Org",
      slug: "owned-org",
    },
  ]),
  memberships: vi.fn(async () => [
    {
      organizationId: "org_owned",
      role: "member",
    },
    {
      organizationId: "org_member",
      role: "admin",
    },
  ]),
  findOrganization: vi.fn(async (id: string) =>
    id === "org_member"
      ? {
          id,
          name: "Member Org",
          slug: "member-org",
        }
      : null,
  ),
  findSummaries: vi.fn(
    async (ids: readonly string[]): Promise<Array<{ id: string; name: string; slug: string }>> =>
      ids
        .filter((id) => id === "org_member")
        .map((id) => ({ id, name: "Member Org", slug: "member-org" })),
  ),
  findUserContext: vi.fn(
    async (
      _id: string,
      _userId: string,
    ): Promise<{ id: string; name: string; slug: string; role: string } | null> => null,
  ),
};

/** Factory for `vi.mock("../site/src/lib/services/auth-service", …)` from suite files under `site/tests/unit` or `site/tests/database`. */
export function createContextSwitchingAuthMock() {
  return {
    authService: {
      getSession: contextSwitchingMocks.getSession,
      getSessionIdentity: contextSwitchingMocks.getSessionIdentity,
      switchContext: contextSwitchingMocks.switchContext,
    },
  };
}

/** Factory for `vi.mock("@nexus/db", …)` from suite files under `site/tests/unit` or `site/tests/database`. */
export function createContextSwitchingDbMock() {
  return {
    organizationRepository: {
      listOwnedByUser: contextSwitchingMocks.owned,
      listUserMemberships: contextSwitchingMocks.memberships,
      findById: contextSwitchingMocks.findOrganization,
      findSummariesByIds: contextSwitchingMocks.findSummaries,
      findUserContext: contextSwitchingMocks.findUserContext,
    },
  };
}

/** Factory for `vi.mock("@nexus/security", …)` from suite files under `site/tests/unit` or `site/tests/database`. */
export function createContextSwitchingSecurityMock() {
  return {
    consumeRateLimit: vi.fn(async () => ({
      success: contextSwitchingState.allowed,
    })),
  };
}

export function contextSwitchingGetRequest() {
  return new NextRequest("https://nexus.test/api/auth/context", {
    headers: {
      cookie: "nexus_session=context-token",
    },
  });
}

export function contextSwitchingPostRequest(body: unknown) {
  return new NextRequest("https://nexus.test/api/auth/context", {
    method: "POST",
    headers: {
      origin: "https://nexus.test",
      "content-type": "application/json",
      cookie: "nexus_session=context-token",
    },
    body: JSON.stringify(body),
  });
}

export function expectContextSwitchingPrivateCorrelation(response: Response) {
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{20,}$/u);
}

function resetContextSwitchingState() {
  vi.clearAllMocks();
  contextSwitchingState.user = {
    id: "usr_context",
    displayName: "Context User",
    activeContextId: "org_owned",
  };
  contextSwitchingState.allowed = true;
}

/** Shared session/rate-limit lifecycle for every context-switching HTTP suite. */
export function installContextSwitchingLifecycle() {
  beforeEach(() => {
    resetContextSwitchingState();
  });
}
