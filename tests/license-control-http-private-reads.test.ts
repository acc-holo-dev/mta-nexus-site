import { NextRequest } from "next/server";
import { expect, it, vi } from "vitest";

vi.mock("@nexus/db", async () => {
  const { createLicenseControlHttpDbMock } = await import("./helpers/license-control-http-harness");
  return createLicenseControlHttpDbMock();
});
vi.mock("@nexus/security", async (importOriginal) => {
  const { licenseControlHttpState } = await import("./helpers/license-control-http-harness");
  return {
    ...(await importOriginal<typeof import("@nexus/security")>()),
    consumeRateLimit: vi.fn(async () => ({ success: licenseControlHttpState.allowed })),
  };
});
vi.mock("../site/src/lib/services/auth-service", async () => {
  const { licenseControlHttpState } = await import("./helpers/license-control-http-harness");
  return {
    authService: { getSession: async () => licenseControlHttpState.user },
  };
});
vi.mock("../site/src/lib/request-client-ip", () => ({ getTrustedRequestIp: () => "unknown" }));

import { GET as staffActivity } from "../site/src/app/api/admin/licenses/[id]/activity/route";
import { GET as activity } from "../site/src/app/api/licenses/[id]/activity/route";
import { GET as detail } from "../site/src/app/api/licenses/[id]/route";
import { GET as runtimeConfig } from "../site/src/app/api/licenses/[id]/runtime-config/route";
import { GET as servers } from "../site/src/app/api/licenses/[id]/servers/route";
import {
  licenseControlHttpContext as context,
  installLicenseControlHttpLifecycle,
  licenseControlHttpState as state,
} from "./helpers/license-control-http-harness";

installLicenseControlHttpLifecycle();

it("does not reveal another buyer's license detail", async () => {
  state.detail.mockResolvedValue(null);
  const response = await detail(new NextRequest("https://nexus.test/api/licenses/lic_a"), context);
  expect(state.detail).toHaveBeenCalledWith("lic_a", "usr_a");
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ code: "NOT_FOUND" });
});

it("scopes private configuration and history to the current buyer and paginates staff under live checks", async () => {
  state.releasePage.mockResolvedValue({
    licenseId: "lic_a",
    productId: "prd_a",
    serverId: "srv_a",
    items: [],
    page: 2,
    pageSize: 20,
    totalPages: 2,
    total: 20,
  });
  state.historyPage.mockResolvedValue({
    license: { id: "lic_a", productTitle: "Resource" },
    items: [],
    page: 2,
    totalPages: 2,
  });
  const config = await runtimeConfig(
    new NextRequest("https://nexus.test/api/licenses/lic_a/runtime-config?page=2"),
    context,
  );
  expect(config.status).toBe(200);
  expect(config.headers.get("cache-control")).toBe("private, no-store");
  expect(state.releasePage).toHaveBeenCalledWith("lic_a", "usr_a", 2);
  expect(
    (
      await activity(
        new NextRequest("https://nexus.test/api/licenses/lic_a/activity?page=2"),
        context,
      )
    ).status,
  ).toBe(200);
  expect(state.historyPage).toHaveBeenCalledWith("lic_a", "usr_a", false, 2);
  expect(
    (
      await staffActivity(
        new NextRequest("https://nexus.test/api/admin/licenses/lic_a/activity"),
        context,
      )
    ).status,
  ).toBe(403);
  state.user = { id: "usr_a", role: "moderator" };
  expect(
    (
      await staffActivity(
        new NextRequest("https://nexus.test/api/admin/licenses/lic_a/activity?page=2"),
        context,
      )
    ).status,
  ).toBe(200);
  expect(state.historyPage).toHaveBeenCalledWith("lic_a", "usr_a", true, 2);
});

it("rejects ambiguous private filters and guests without loading any private configuration", async () => {
  for (const route of [runtimeConfig, activity]) {
    expect(
      (
        await route(
          new NextRequest("https://nexus.test/api/licenses/lic_a/runtime-config?page=1&page=2"),
          context,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await route(
          new NextRequest("https://nexus.test/api/licenses/lic_a/runtime-config?ownerId=usr_other"),
          context,
        )
      ).status,
    ).toBe(400);
    state.user = null;
    expect(
      (
        await route(
          new NextRequest("https://nexus.test/api/licenses/lic_a/runtime-config"),
          context,
        )
      ).status,
    ).toBe(401);
    state.user = { id: "usr_a", role: "user" };
  }
  expect(state.releasePage).not.toHaveBeenCalled();
  expect(state.historyPage).not.toHaveBeenCalled();
});

it("only returns eligible servers for the original actor", async () => {
  const get = (actorId: string) =>
    new NextRequest("https://nexus.test/api/licenses/lic_a/servers?page=1", {
      headers: { cookie: "nexus_session=initiating-session", "x-nexus-actor-id": actorId },
    });
  expect((await servers(get(""), context)).status).toBe(428);
  const wrong = await servers(get("usr_b"), context);
  expect(wrong.status).toBe(409);
  expect(state.servers).not.toHaveBeenCalled();
  state.servers.mockResolvedValue({ servers: [], page: 1, totalPages: 1 });
  const response = await servers(get("usr_a"), context);
  expect(await response.json()).toMatchObject({ actorId: "usr_a", servers: [] });
});
