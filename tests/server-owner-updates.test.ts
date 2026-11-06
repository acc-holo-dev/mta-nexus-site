import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../apps/web/src/lib/services/auth-service", async () => {
  const { serverOwnerUpdatesState } = await import("./helpers/server-owner-updates-harness");
  return {
    authService: {
      getSession: vi.fn(async () => serverOwnerUpdatesState.user),
    },
  };
});

vi.mock("../apps/web/src/lib/services/server-service", async () => {
  const { serverOwnerUpdatesGetManagedServerDetails, serverOwnerUpdatesUpdateServer } =
    await import("./helpers/server-owner-updates-harness");
  return {
    serverService: {
      updateServer: serverOwnerUpdatesUpdateServer,
      getManagedServerDetails: serverOwnerUpdatesGetManagedServerDetails,
    },
  };
});

vi.mock("@nexus/security", async () => {
  const { serverOwnerUpdatesState } = await import("./helpers/server-owner-updates-harness");
  return {
    consumeRateLimit: vi.fn(async () => ({
      success: serverOwnerUpdatesState.allowed,
    })),
  };
});

import { GET } from "../apps/web/src/app/api/servers/[id]/route";
import {
  expectServerOwnerUpdatesPrivateCorrelation as expectPrivateCorrelation,
  installServerOwnerUpdatesLifecycle,
  serverOwnerUpdatesGetManagedServerDetails as getManagedServerDetails,
  serverOwnerUpdatesRouteContext as routeContext,
  serverOwnerUpdatesState as state,
} from "./helpers/server-owner-updates-harness";

installServerOwnerUpdatesLifecycle();

describe("server owner update HTTP reads", () => {
  it("returns only managed details to the authenticated actor", async () => {
    const input = new NextRequest("https://nexus.test/api/servers/srv_1");
    getManagedServerDetails
      .mockResolvedValueOnce({
        id: "srv_1",
        name: "Server",
        updatedAt: new Date("2026-10-10T02:15:00.000Z"),
        ipAddress: "203.0.113.7",
        port: 22003,
        visibility: "public",
        privateField: "secret",
      })
      .mockResolvedValueOnce(null);
    const response = await GET(input, routeContext);
    expect(response.status).toBe(200);
    expectPrivateCorrelation(response);
    const body = await response.json();
    expect(getManagedServerDetails).toHaveBeenCalledWith("srv_1", state.user);
    expect(body.actorId).toBe("usr_server_owner");
    expect(body.server).toMatchObject({
      id: "srv_1",
      name: "Server",
      updatedAt: "2026-10-10T02:15:00.000Z",
    });
    expect(body.server).not.toHaveProperty("privateField");
    expect((await GET(input, routeContext)).status).toBe(404);
    state.user = null;
    expect((await GET(input, routeContext)).status).toBe(401);
  });

  it("rate-limits private server detail reads before lookup", async () => {
    state.allowed = false;
    const input = new NextRequest("https://nexus.test/api/servers/srv_1");
    expect((await GET(input, routeContext)).status).toBe(429);
    expect(getManagedServerDetails).not.toHaveBeenCalled();
  });
});
