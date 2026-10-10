import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({
  user: {
    id: "usr_server_owner",
    role: "developer",
  } as Record<string, unknown> | null,
  allowed: true,
}));

const updateServer = vi.hoisted(() =>
  vi.fn(async (_id, input) => ({
    id: "srv_1",
    ...input,
  })),
);

vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: {
    getSession: vi.fn(async () => state.user),
  },
}));

vi.mock("../apps/web/src/lib/services/server-service", () => ({
  serverService: {
    updateServer,
  },
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: vi.fn(async () => ({
    success: state.allowed,
  })),
}));

import { PATCH } from "../apps/web/src/app/api/servers/[id]/route";

function request(body: unknown) {
  return new NextRequest(
    "https://nexus.test/api/servers/srv_1",
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        cookie:
          "nexus_session=server-owner-token",
      },
      body: JSON.stringify(body),
    },
  );
}

const routeContext = {
  params: Promise.resolve({ id: "srv_1" }),
};

function expectPrivateCorrelation(
  response: Response,
) {
  expect(
    response.headers.get("cache-control"),
  ).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe(
    "Cookie",
  );
  expect(
    response.headers.get("x-request-id"),
  ).toMatch(/^[0-9a-f-]{20,}$/u);
}

describe("server owner update HTTP contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.user = {
      id: "usr_server_owner",
      role: "developer",
    };
    state.allowed = true;
  });

  it("updates only the strict public-card schema", async () => {
    const response = await PATCH(
      request({
        name: "Nexus Racing",
        description: "Public description",
        visibility: "unlisted",
      }),
      routeContext,
    );

    expect(response.status).toBe(200);
    expectPrivateCorrelation(response);
    expect(updateServer).toHaveBeenCalledWith(
      "srv_1",
      {
        name: "Nexus Racing",
        description: "Public description",
        visibility: "unlisted",
      },
      state.user,
    );
  });

  it("accepts safe links and the full editable network metadata", async () => {
    const fields = {
      websiteUrl: "https://example.com",
      mediaUrls: ["https://example.com/screenshot.png"],
      httpPort: 22006,
      mapName: "Los Santos",
    };
    const response = await PATCH(request(fields), routeContext);
    expect(response.status).toBe(200);
    expect(updateServer).toHaveBeenCalledWith("srv_1", fields, state.user);
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,hello",
    "file:///etc/passwd",
    "https://user:pass@example.com",
    " https://example.com",
  ])("rejects unsafe link %s in each owner-edit URL field", async (url) => {
    for (const field of ["websiteUrl", "discordUrl", "rulesUrl", "mediaUrls"]) {
      updateServer.mockClear();
      const value = field === "mediaUrls" ? [url] : url;
      const response = await PATCH(request({ [field]: value }), routeContext);
      expect(response.status).toBe(400);
      expectPrivateCorrelation(response);
      expect(updateServer).not.toHaveBeenCalled();
    }
  });

  it("rejects an oversized PATCH request before database mutation", async () => {
    const response = await PATCH(
      request({ description: "x".repeat(40_000) }),
      routeContext,
    );
    expect(response.status).toBe(413);
    expectPrivateCorrelation(response);
    expect(await response.json()).toMatchObject({
      code: "REQUEST_BODY_TOO_LARGE",
    });
    expect(updateServer).not.toHaveBeenCalled();
  });

  it("passes an explicit version token to the authoritative update", async () => {
    const response = await PATCH(
      request({
        description: "Updated once",
        expectedUpdatedAt: "2026-10-10T02:15:00.000Z",
      }),
      routeContext,
    );
    expect(response.status).toBe(200);
    expect(updateServer).toHaveBeenCalledWith(
      "srv_1",
      { description: "Updated once" },
      state.user,
      new Date("2026-10-10T02:15:00.000Z"),
    );
  });

  it.each([
    { expectedUpdatedAt: "2026-10-10T02:15:00.000Z" },
    { name: "Nexus Server", expectedUpdatedAt: "not-a-date" },
    { name: "Nexus Server", expectedUpdatedAt: "2026-10-10" },
  ])("rejects token-only or invalid optimistic updates: %j", async (body) => {
    const response = await PATCH(request(body), routeContext);
    expect(response.status).toBe(400);
    expect(updateServer).not.toHaveBeenCalled();
  });

  it.each([{}, { slug: "hijacked" }, { organizationId: "org_other" }])(
    "rejects empty or protected update payload %j",
    async (body) => {
      const response = await PATCH(request(body), routeContext);
      expect(response.status).toBe(400);
      expect(updateServer).not.toHaveBeenCalled();
    },
  );

  it.each([
    { ownerId: "usr_attacker" },
    { status: "suspended" },
    {
      name: "Nexus Racing",
      ownerId: "usr_attacker",
    },
  ])(
    "rejects authority/state field injection before the service: %j",
    async (body) => {
      const response = await PATCH(
        request(body),
        routeContext,
      );

      expect(response.status).toBe(400);
      expectPrivateCorrelation(response);
      expect(updateServer).not.toHaveBeenCalled();
    },
  );

  it("requires authentication and rate-limit budget before mutation", async () => {
    state.user = null;
    const anonymous = await PATCH(
      request({ name: "Nexus Racing" }),
      routeContext,
    );
    expect(anonymous.status).toBe(401);
    expectPrivateCorrelation(anonymous);
    expect(updateServer).not.toHaveBeenCalled();

    state.user = {
      id: "usr_server_owner",
      role: "developer",
    };
    state.allowed = false;
    const limited = await PATCH(
      request({ name: "Nexus Racing" }),
      routeContext,
    );
    expect(limited.status).toBe(429);
    expectPrivateCorrelation(limited);
    expect(updateServer).not.toHaveBeenCalled();
  });
});
