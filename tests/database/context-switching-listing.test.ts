import { describe, expect, it, vi } from "vitest";

vi.mock("../../site/src/lib/services/auth-service", async () => {
  const { createContextSwitchingAuthMock } = await import("../helpers/context-switching-harness");
  return createContextSwitchingAuthMock();
});

vi.mock("@nexus/db", async () => {
  const { createContextSwitchingDbMock } = await import("../helpers/context-switching-harness");
  return createContextSwitchingDbMock();
});

vi.mock("@nexus/security", async () => {
  const { createContextSwitchingSecurityMock } = await import(
    "../helpers/context-switching-harness"
  );
  return createContextSwitchingSecurityMock();
});

import { GET } from "../../site/src/app/api/auth/context/route";
import {
  contextSwitchingMocks,
  expectContextSwitchingPrivateCorrelation as expectPrivateCorrelation,
  contextSwitchingGetRequest as getRequest,
  installContextSwitchingLifecycle,
  contextSwitchingState as state,
} from "../helpers/context-switching-harness";

const { owned, memberships, findOrganization, findSummaries, findUserContext } =
  contextSwitchingMocks;

installContextSwitchingLifecycle();

describe("account context switching listing HTTP contract", () => {
  it("returns bounded, deduplicated owner and membership contexts", async () => {
    const response = await GET(getRequest());
    expect(response.status).toBe(200);
    expectPrivateCorrelation(response);

    await expect(response.json()).resolves.toEqual({
      actorId: "usr_context",
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
    expect(owned).toHaveBeenCalledWith("usr_context", 50);
    expect(findOrganization).not.toHaveBeenCalled();
    expect(findSummaries).toHaveBeenCalledExactlyOnceWith(["org_member"]);
  });

  it.each([0, 1, 50])(
    "reads at most the remaining context capacity with %s owned organizations",
    async (ownerCount) => {
      owned.mockResolvedValueOnce(
        Array.from({ length: ownerCount }, (_, index) => ({
          id: `org_owned_${index}`,
          name: `Owned ${index}`,
          slug: `owned-${index}`,
        })),
      );
      const memberRows = Array.from({ length: 100 }, (_, index) => ({
        organizationId: `org_member_${index}`,
        role: index % 2 ? "member" : "admin",
      }));
      memberships.mockResolvedValueOnce([
        ...Array.from({ length: ownerCount }, (_, index) => ({
          organizationId: `org_owned_${index}`,
          role: "member",
        })),
        ...memberRows,
      ]);
      const selected = memberRows.slice(0, 50 - ownerCount);
      if (selected.length)
        findSummaries.mockResolvedValueOnce(
          selected
            .map((row) => ({
              id: row.organizationId,
              name: row.organizationId,
              slug: row.organizationId,
            }))
            .reverse(),
        );

      const response = await GET(getRequest());
      const body = await response.json();
      expect(response.status).toBe(200);
      expectPrivateCorrelation(response);
      expect(body.contexts).toHaveLength(51);
      expect(body.contexts.slice(1, ownerCount + 1)).toEqual(
        Array.from({ length: ownerCount }, (_, index) =>
          expect.objectContaining({
            id: `org_owned_${index}`,
            role: "owner",
          }),
        ),
      );
      expect(body.contexts.slice(ownerCount + 1)).toEqual(
        selected.map((row) =>
          expect.objectContaining({
            id: row.organizationId,
            role: row.role,
          }),
        ),
      );
      expect(findOrganization).not.toHaveBeenCalled();
      if (selected.length) {
        expect(findSummaries).toHaveBeenCalledExactlyOnceWith(
          selected.map((row) => row.organizationId),
        );
      } else {
        expect(findSummaries).not.toHaveBeenCalled();
      }
    },
  );

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
      "personal",
      "org_owned",
      "org_member",
    ]);
    expect(findSummaries).toHaveBeenCalledExactlyOnceWith(["org_member", "org_missing"]);
  });

  it.each(["owner", "admin"])(
    "preserves an active %s context beyond the 50-item list",
    async (role) => {
      state.user = {
        id: "usr_context",
        displayName: "Context User",
        activeContextId: "org_active",
      };
      owned.mockResolvedValueOnce(
        Array.from({ length: 50 }, (_, index) => ({
          id: `org_${index}`,
          name: `Org ${index}`,
          slug: `org-${index}`,
        })),
      );
      memberships.mockResolvedValueOnce([]);
      findUserContext.mockResolvedValueOnce({
        id: "org_active",
        name: "Active",
        slug: "active",
        role,
      });

      const response = await GET(getRequest());
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.activeContextId).toBe("org_active");
      expect(body.contexts).toHaveLength(51);
      expect(body.contexts).toContainEqual({
        id: "org_active",
        name: "Active",
        slug: "active",
        role,
        type: "organization",
      });
      expect(findUserContext).toHaveBeenCalledExactlyOnceWith("org_active", "usr_context");
    },
  );

  it("does not expose an active context after access is revoked", async () => {
    state.user = { id: "usr_context", displayName: "Context User", activeContextId: "org_revoked" };
    const response = await GET(getRequest());
    const body = await response.json();
    expect(body.activeContextId).toBe("personal");
    expect(body.contexts.some((context: { id: string }) => context.id === "org_revoked")).toBe(
      false,
    );
    expect(findUserContext).toHaveBeenCalledExactlyOnceWith("org_revoked", "usr_context");
  });

  it("returns a correlated private 503 if the batch read fails", async () => {
    findSummaries.mockRejectedValueOnce(new Error("Database unavailable"));
    const response = await GET(getRequest());
    expect(response.status).toBe(503);
    expectPrivateCorrelation(response);
    await expect(response.json()).resolves.toEqual({
      error: "Account contexts are temporarily unavailable.",
    });
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
});
