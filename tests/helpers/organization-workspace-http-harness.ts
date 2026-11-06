import { NextRequest } from "next/server";
import { afterEach, beforeEach, vi } from "vitest";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "../browser-mutation-headers";

/** Shared mutable session for organization-workspace HTTP suites. */
export const organizationWorkspaceHttpState = {
  actor: { id: "owner", role: "user" } as Record<string, unknown> | null,
};

/** Shared repository/service mocks for organization-workspace HTTP suites. */
export const organizationWorkspaceHttpMocks = {
  pageMine: vi.fn(),
  leave: vi.fn(),
  getWorkspace: vi.fn(),
  create: vi.fn(),
  updateProfile: vi.fn(),
  addMember: vi.fn(),
  changeMember: vi.fn(),
  rate: vi.fn(),
};

/** Canonical organization revision used by optimistic writes. */
export const organizationWorkspaceHttpVersion = "2026-10-10T12:00:00.000Z";

/** Editable profile fields for create/update assertions. */
export const organizationWorkspaceHttpFields = {
  name: "Team",
  description: "Description",
  logoUrl: "",
  websiteUrl: "",
};

/** Stored organization fixture returned by repository mocks. */
export const organizationWorkspaceHttpStored = {
  ...organizationWorkspaceHttpFields,
  id: "org",
  slug: "team",
  ownerId: "owner",
  isVerified: false,
  createdAt: new Date(organizationWorkspaceHttpVersion),
  updatedAt: new Date(organizationWorkspaceHttpVersion),
};

/** Route context for organization detail/member routes. */
export const organizationWorkspaceHttpContext = {
  params: Promise.resolve({ id: "org", userId: "member" }),
};

/** Factory for `vi.mock("@nexus/db", …)`. */
export function createOrganizationWorkspaceHttpDbMock() {
  return { organizationWorkspaceRepository: organizationWorkspaceHttpMocks };
}

/** Factory for auth-service mock. */
export function createOrganizationWorkspaceHttpAuthMock() {
  return {
    authService: { getSession: async () => organizationWorkspaceHttpState.actor },
  };
}

/** Factory for `@nexus/security` mock. */
export function createOrganizationWorkspaceHttpSecurityMock() {
  return {
    consumeRateLimit: organizationWorkspaceHttpMocks.rate,
    generateId: (p: string) => `${p}_new`,
  };
}

/** Shared request builder for organization workspace HTTP handlers. */
export function organizationWorkspaceHttpRequest(
  method: string,
  body?: unknown,
  locale = "en",
  headers = {},
) {
  return new NextRequest("http://nexus.test/api/workspace/organizations?page=2&q=team", {
    method,
    headers: {
      ...browserMutationHeaders(),
      cookie: `nexus_session=test;nexus_locale=${locale}`,
      "content-type": "application/json",
      "x-nexus-actor-id": "owner",
      "x-nexus-creation-nonce": "a".repeat(32),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

export function installOrganizationWorkspaceHttpHooks() {
  beforeEach(() => {
    stubBrowserMutationOrigin();
    vi.clearAllMocks();
    organizationWorkspaceHttpState.actor = { id: "owner", role: "user" };
    organizationWorkspaceHttpMocks.rate.mockResolvedValue({ success: true });
    organizationWorkspaceHttpMocks.pageMine.mockResolvedValue({
      items: [{ ...organizationWorkspaceHttpStored, role: "owner" }],
      page: 2,
      hasMore: false,
    });
    organizationWorkspaceHttpMocks.getWorkspace.mockResolvedValue({
      organization: organizationWorkspaceHttpStored,
      role: "owner",
      owner: null,
      members: [],
      page: 2,
      hasMore: false,
    });
    organizationWorkspaceHttpMocks.create.mockResolvedValue(organizationWorkspaceHttpStored);
    organizationWorkspaceHttpMocks.updateProfile.mockResolvedValue(organizationWorkspaceHttpStored);
    organizationWorkspaceHttpMocks.addMember.mockResolvedValue({
      organization: organizationWorkspaceHttpStored,
      member: {
        id: "member",
        username: "member",
        displayName: "Member",
        avatarUrl: null,
        role: "developer",
        managesServers: true,
      },
    });
    organizationWorkspaceHttpMocks.changeMember.mockResolvedValue({
      organization: organizationWorkspaceHttpStored,
      userId: "member",
      removed: true,
    });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });
}
