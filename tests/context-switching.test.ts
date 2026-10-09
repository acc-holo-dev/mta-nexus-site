import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({
  user: {
    id: "usr_context",
    displayName: "Context User",
    activeContextId: "org_owned",
  } as {
    id: string;
    displayName: string;
    activeContextId?: string | null;
  } | null,
  allowed: true,
}));

const getSession = vi.hoisted(() =>
  vi.fn(async () => state.user),
);
const switchContext = vi.hoisted(() =>
  vi.fn(async (_userId: string, contextId: string) => ({
    ...state.user,
    activeContextId: contextId,
  })),
);
const owned = vi.hoisted(() =>
  vi.fn(async () => [
    {
      id: "org_owned",
      name: "Owned Org",
      slug: "owned-org",
    },
  ]),
);
const memberships = vi.hoisted(() =>
  vi.fn(async () => [
    {
      organizationId: "org_owned",
      role: "member",
    },
    {
      organizationId: "org_member",
      role: "admin",
    },
  ]),
);
const findOrganization = vi.hoisted(() =>
  vi.fn(async (id: string) =>
    id === "org_member"
      ? {
          id,
          name: "Member Org",
          slug: "member-org",
        }
      : null,
  ),
);
const findSummaries = vi.hoisted(() =>
  vi.fn(async (ids: readonly string[]): Promise<Array<{ id: string; name: string; slug: string }>> => ids
    .filter(id => id === "org_member")
    .map(id => ({ id, name: "Member Org", slug: "member-org" }))),
);

vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: {
    getSession,
    switchContext,
  },
}));

vi.mock("@nexus/db", () => ({
  organizationRepository: {
    listOwnedByUser: owned,
    listUserMemberships: memberships,
    findById: findOrganization,
    findSummariesByIds: findSummaries,
  },
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: vi.fn(async () => ({
    success: state.allowed,
  })),
}));

import {
  GET,
  POST,
} from "../apps/web/src/app/api/auth/context/route";

function getRequest() {
  return new NextRequest(
    "https://nexus.test/api/auth/context",
    {
      headers: {
        cookie: "nexus_session=context-token",
      },
    },
  );
}

function postRequest(body: unknown) {
  return new NextRequest(
    "https://nexus.test/api/auth/context",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "nexus_session=context-token",
      },
      body: JSON.stringify(body),
    },
  );
}

function expectPrivateCorrelation(response: Response) {
  expect(response.headers.get("cache-control")).toBe(
    "private, no-store",
  );
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(response.headers.get("x-request-id")).toMatch(
    /^[0-9a-f-]{20,}$/u,
  );
}

describe("account context switching HTTP contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.user = {
      id: "usr_context",
      displayName: "Context User",
      activeContextId: "org_owned",
    };
    state.allowed = true;
  });

  it("returns bounded, deduplicated owner and membership contexts", async () => {
    const response = await GET(getRequest());
    expect(response.status).toBe(200);
    expectPrivateCorrelation(response);

    await expect(response.json()).resolves.toEqual({
      activeContextId: "org_owned",
      contexts: [
        {
          id: "personal",
          type: "personal",
          name: "Context User",
          role: "personal",
        },
        {
          id: "org_owned",
          type: "organization",
          name: "Owned Org",
          slug: "owned-org",
          role: "owner",
        },
        {
          id: "org_member",
          type: "organization",
          name: "Member Org",
          slug: "member-org",
          role: "admin",
        },
      ],
    });
    expect(owned).toHaveBeenCalledWith(
      "usr_context",
      50,
    );
    expect(findOrganization).not.toHaveBeenCalled();
    expect(findSummaries).toHaveBeenCalledExactlyOnceWith(["org_member"]);
  });

  it.each([0, 1, 50])("reads at most the remaining context capacity with %s owned organizations", async ownerCount => {
    owned.mockResolvedValueOnce(Array.from({ length: ownerCount }, (_, index) => ({
      id: `org_owned_${index}`, name: `Owned ${index}`, slug: `owned-${index}`,
    })));
    const memberRows = Array.from({ length: 100 }, (_, index) => ({
      organizationId: `org_member_${index}`, role: index % 2 ? "member" : "admin",
    }));
    memberships.mockResolvedValueOnce([
      ...Array.from({ length: ownerCount }, (_, index) => ({
        organizationId: `org_owned_${index}`, role: "member",
      })),
      ...memberRows,
    ]);
    const selected = memberRows.slice(0, 50 - ownerCount);
    if (selected.length) findSummaries.mockResolvedValueOnce(selected.map(row => ({
      id: row.organizationId, name: row.organizationId, slug: row.organizationId,
    })).reverse());

    const response = await GET(getRequest());
    const body = await response.json();
    expect(response.status).toBe(200);
    expectPrivateCorrelation(response);
    expect(body.contexts).toHaveLength(51);
    expect(body.contexts.slice(1, ownerCount + 1)).toEqual(
      Array.from({ length: ownerCount }, (_, index) => expect.objectContaining({
        id: `org_owned_${index}`, role: "owner",
      })),
    );
    expect(body.contexts.slice(ownerCount + 1)).toEqual(selected.map(row => expect.objectContaining({
      id: row.organizationId, role: row.role,
    })));
    expect(findOrganization).not.toHaveBeenCalled();
    if (selected.length) {
      expect(findSummaries).toHaveBeenCalledExactlyOnceWith(selected.map(row => row.organizationId));
    } else {
      expect(findSummaries).not.toHaveBeenCalled();
    }
  });

  it("omits missing membership organizations and falls back from a removed context", async () => {
    state.user = { id: "usr_context", displayName: "Context User", activeContextId: "org_missing" };
    memberships.mockResolvedValueOnce([
      { organizationId: "org_member", role: "admin" },
      { organizationId: "org_missing", role: "member" },
    ]);
    const response = await GET(getRequest());
    const body = await response.json();
    expect(body.activeContextId).toBe("personal");
    expect(body.contexts.map((context: { id: string }) => context.id)).toEqual([
      "personal", "org_owned", "org_member",
    ]);
    expect(findSummaries).toHaveBeenCalledExactlyOnceWith(["org_member", "org_missing"]);
  });

  it("returns a correlated private 503 if the batch read fails", async () => {
    findSummaries.mockRejectedValueOnce(new Error("Database unavailable"));
    const response = await GET(getRequest());
    expect(response.status).toBe(503);
    expectPrivateCorrelation(response);
    await expect(response.json()).resolves.toEqual({ error: "Account contexts are temporarily unavailable." });
  });

  it("falls back to personal if the saved context is no longer available", async () => {
    state.user = {
      id: "usr_context",
      displayName: "Context User",
      activeContextId: "org_missing",
    };

    const response = await GET(getRequest());
    expectPrivateCorrelation(response);
    await expect(response.json()).resolves.toMatchObject({
      activeContextId: "personal",
    });
  });

  it("returns a correlated private 401 without reading organizations", async () => {
    state.user = null;

    const response = await GET(getRequest());
    expect(response.status).toBe(401);
    expectPrivateCorrelation(response);
    expect(owned).not.toHaveBeenCalled();
    expect(memberships).not.toHaveBeenCalled();
    expect(findSummaries).not.toHaveBeenCalled();
  });

  it("validates and rate-limits context switches before mutation", async () => {
    const malformed = await POST(
      postRequest({
        contextId: "org_member",
        extra: true,
      }),
    );
    expect(malformed.status).toBe(400);
    expectPrivateCorrelation(malformed);
    expect(switchContext).not.toHaveBeenCalled();

    state.allowed = false;
    const limited = await POST(
      postRequest({ contextId: "org_member" }),
    );
    expect(limited.status).toBe(429);
    expectPrivateCorrelation(limited);
    expect(switchContext).not.toHaveBeenCalled();
  });

  it("returns the authoritative switched context with request correlation", async () => {
    const response = await POST(
      postRequest({ contextId: "org_member" }),
    );

    expect(response.status).toBe(200);
    expectPrivateCorrelation(response);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      activeContextId: "org_member",
    });
    expect(switchContext).toHaveBeenCalledWith(
      "usr_context",
      "org_member",
    );
  });
});
