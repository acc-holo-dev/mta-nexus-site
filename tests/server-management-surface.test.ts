import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "../apps/web/src/lib/i18n";

const state = vi.hoisted(() => ({
  user: {
    id: "usr_manager",
    username: "manager",
    role: "user",
  } as null | { id: string; username: string; role: string },
  notFoundCalls: 0,
}));

const serverService = vi.hoisted(() => ({
  getServerById: vi.fn(),
  canManageServer: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      name === "nexus_session" && state.user
        ? { value: "session-token" }
        : undefined,
  })),
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    state.notFoundCalls += 1;
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({
      href,
      children
    }: {
      href: string;
      children: ReactNode;
    }) => React.createElement("a", { href }, children),
  };
});

vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: {
    getSession: vi.fn(async () => state.user),
  },
}));

vi.mock("../apps/web/src/lib/services/server-service", () => ({
  serverService,
}));

vi.mock("../apps/web/src/lib/i18n-server", () => ({
  getRequestLocale: vi.fn(async () => "en"),
}));

vi.mock("../apps/web/src/components/server-details-form", async () => {
  const React = await import("react");
  return {
    ServerDetailsForm: () =>
      React.createElement("div", { "data-testid": "server-details-form" }),
  };
});

vi.mock(
  "../apps/web/src/components/server-claim-control-panel",
  async () => {
    const React = await import("react");
    return {
      ServerClaimControlPanel: () =>
        React.createElement("div", {
          "data-testid": "server-claim-control-panel",
        }),
    };
  },
);

import ServerManagementPage from "../apps/web/src/app/workspace/servers/[id]/page";

describe("server management page behavior", () => {
  const dictionary = getDictionary("en").serverManagement;
  const server = {
    id: "srv_managed",
    slug: "managed-server",
    name: "Managed Server",
    ipAddress: "203.0.113.20",
    port: 22003,
    isVerified: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    state.notFoundCalls = 0;
    state.user = {
      id: "usr_manager",
      username: "manager",
      role: "user",
    };
    serverService.getServerById.mockResolvedValue(server);
    serverService.canManageServer.mockResolvedValue(true);
  });

  it("renders a sign-in boundary without reading a server for an anonymous visitor", async () => {
    state.user = null;

    const html = renderToStaticMarkup(
      await ServerManagementPage({
        params: Promise.resolve({ id: "srv_managed" }),
      }),
    );

    expect(html).toContain(dictionary.signInRequired);
    expect(serverService.getServerById).not.toHaveBeenCalled();
    expect(serverService.canManageServer).not.toHaveBeenCalled();
  });

  it("fails closed when the server does not exist", async () => {
    serverService.getServerById.mockResolvedValue(null);

    await expect(
      ServerManagementPage({
        params: Promise.resolve({ id: "srv_missing" }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(serverService.canManageServer).not.toHaveBeenCalled();
    expect(state.notFoundCalls).toBe(1);
  });

  it("fails closed when the current user is not an authorized manager", async () => {
    serverService.canManageServer.mockResolvedValue(false);

    await expect(
      ServerManagementPage({
        params: Promise.resolve({ id: "srv_managed" }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(serverService.canManageServer).toHaveBeenCalledWith(
      server,
      state.user,
    );
    expect(state.notFoundCalls).toBe(1);
  });

  it("renders listing management and claim controls for an authorized unverified server", async () => {
    const html = renderToStaticMarkup(
      await ServerManagementPage({
        params: Promise.resolve({ id: "srv_managed" }),
      }),
    );

    expect(serverService.canManageServer).toHaveBeenCalledWith(
      server,
      state.user,
    );
    expect(html).toContain(dictionary.ownerManaged);
    expect(html).toContain(dictionary.ownerManagedDescription);
    expect(html).toContain(dictionary.listingDetails);
    expect(html).toContain('href="/workspace/servers/srv_managed/activity"');
    expect(html).toContain("View activity");
    expect(html).toContain('data-testid="server-details-form"');
    expect(html).toContain('data-testid="server-claim-control-panel"');
    expect(html).not.toMatch(/installation key|heartbeat/iu);
  });

  it("hides ownership-claim controls once the server is verified", async () => {
    serverService.getServerById.mockResolvedValue({
      ...server,
      isVerified: true,
    });

    const html = renderToStaticMarkup(
      await ServerManagementPage({
        params: Promise.resolve({ id: "srv_managed" }),
      }),
    );

    expect(html).toContain('data-testid="server-details-form"');
    expect(html).not.toContain(
      'data-testid="server-claim-control-panel"',
    );
  });
});
