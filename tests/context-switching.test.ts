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
    expect(findOrganization).toHaveBeenCalledTimes(1);
    expect(findOrganization).toHaveBeenCalledWith(
      "org_member",
    );
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
