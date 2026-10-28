import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: null as null | {
    id: string;
    displayName: string;
    activeContextId?: string;
  },
}));

const mocks = vi.hoisted(() => ({
  ownedOrganizations: vi.fn(),
  memberships: vi.fn(),
  findOrganization: vi.fn(),
  preferences: vi.fn(),
  notifications: vi.fn(),
  unreadCount: vi.fn(),
  publishedContent: vi.fn(),
  servers: vi.fn(),
  directory: vi.fn(),
  search: vi.fn(),
  rate: vi.fn(),
}));

vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: {
    getSession: vi.fn(async () => state.user),
  },
}));

vi.mock("@nexus/db", () => ({
  organizationRepository: {
    listOwnedByUser: mocks.ownedOrganizations,
    listUserMemberships: mocks.memberships,
    findById: mocks.findOrganization,
  },
  notificationRepository: {
    getPreferences: mocks.preferences,
    listByUser: mocks.notifications,
    countUnread: mocks.unreadCount,
  },
  contentRepository: {
    listPublished: mocks.publishedContent,
  },
  productRepository: {
    findById: vi.fn(),
  },
}));

vi.mock("../apps/web/src/lib/services/server-service", () => ({
  serverService: {
    listServers: mocks.servers,
  },
}));

vi.mock("../apps/web/src/lib/services/mta-master-directory-service", () => ({
  mtaMasterDirectoryService: {
    getDirectory: mocks.directory,
  },
  matchesMtaEndpoint: vi.fn(() => false),
  mtaLiveStatus: vi.fn(() => "unknown"),
}));

vi.mock("../apps/web/src/lib/services/discovery-service", () => ({
  discoveryService: {
    search: mocks.search,
  },
}));

vi.mock("../apps/web/src/lib/request-client-ip", () => ({
  getTrustedRequestIp: vi.fn(() => "203.0.113.10"),
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: mocks.rate,
  generateId: vi.fn((prefix: string) => `${prefix}_test`),
  can: vi.fn(() => false),
}));

import { GET as getAuthContext } from "../apps/web/src/app/api/auth/context/route";
import { GET as getNotificationPreferences } from "../apps/web/src/app/api/notifications/preferences/route";
import { GET as getNotifications } from "../apps/web/src/app/api/notifications/route";
import { GET as getServers } from "../apps/web/src/app/api/servers/route";
import { GET as getContent } from "../apps/web/src/app/api/content/route";
import { GET as getSearch } from "../apps/web/src/app/api/search/route";
import { GET as getDirectory } from "../apps/web/src/app/api/servers/directory/route";

function request(path: string) {
  const value = new NextRequest(`https://nexus.test${path}`);
  if (state.user) {
    value.cookies.set("nexus_session", "session-token");
  }
  return value;
}

function expectPrivate(response: Response) {
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("Vary")).toBe("Cookie");
}

function expectPublic(response: Response) {
  expect(response.headers.get("Cache-Control")).toMatch(/^public, /u);
  expect(response.headers.get("Vary")).not.toBe("Cookie");
}

describe("HTTP cache visibility contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.user = null;
    mocks.ownedOrganizations.mockResolvedValue([]);
    mocks.memberships.mockResolvedValue([]);
    mocks.findOrganization.mockResolvedValue(null);
    mocks.preferences.mockResolvedValue({
      follow: true,
      content: true,
      system: true,
      security: true,
    });
    mocks.notifications.mockResolvedValue([]);
    mocks.unreadCount.mockResolvedValue(0);
    mocks.publishedContent.mockResolvedValue([]);
    mocks.servers.mockResolvedValue([]);
    mocks.directory.mockResolvedValue({
      servers: [],
      fetchedAt: new Date().toISOString(),
      isStale: false,
    });
    mocks.search.mockResolvedValue([]);
    mocks.rate.mockResolvedValue({ success: true });
  });

  it("keeps account context private for denied and authorized reads", async () => {
    const denied = await getAuthContext(request("/api/auth/context"));
    expect(denied.status).toBe(401);
    expectPrivate(denied);

    state.user = {
      id: "usr_context",
      displayName: "Context User",
      activeContextId: "personal",
    };
    const allowed = await getAuthContext(request("/api/auth/context"));
    expect(allowed.status).toBe(200);
    expectPrivate(allowed);
    expect(await allowed.json()).toMatchObject({
      activeContextId: "personal",
      contexts: [
        expect.objectContaining({
          id: "personal",
          type: "personal",
        }),
      ],
    });
  });

  it("keeps notification preferences private for denied and authorized reads", async () => {
    const denied = await getNotificationPreferences(request("/api/notifications/preferences"));
    expect(denied.status).toBe(401);
    expectPrivate(denied);

    state.user = {
      id: "usr_preferences",
      displayName: "Preferences User",
    };
    const allowed = await getNotificationPreferences(request("/api/notifications/preferences"));
    expect(allowed.status).toBe(200);
    expectPrivate(allowed);
    expect(mocks.preferences).toHaveBeenCalledWith("usr_preferences");
  });

  it("keeps notification inbox state private even for anonymous empty state", async () => {
    const anonymous = await getNotifications(request("/api/notifications"));
    expect(anonymous.status).toBe(200);
    expectPrivate(anonymous);
    expect(await anonymous.json()).toEqual({
      notifications: [],
      unreadCount: 0,
    });

    state.user = {
      id: "usr_notifications",
      displayName: "Notification User",
    };
    mocks.notifications.mockResolvedValue([{ id: "not_1", isRead: false }]);
    mocks.unreadCount.mockResolvedValue(1);

    const authenticated = await getNotifications(
      request("/api/notifications?limit=25&unreadOnly=true"),
    );
    expect(authenticated.status).toBe(200);
    expectPrivate(authenticated);
    expect(mocks.notifications).toHaveBeenCalledWith("usr_notifications", 25, true);
  });

  it("keeps anonymous server listings explicitly public-cacheable", async () => {
    mocks.servers.mockResolvedValue([
      {
        id: "srv_public",
        name: "Public Server",
        slug: "public-server",
      },
    ]);

    const response = await getServers(request("/api/servers?limit=12"));

    expect(response.status).toBe(200);
    expectPublic(response);
    expect(mocks.servers).toHaveBeenCalledWith(12);
  });

  it("keeps published content explicitly public-cacheable", async () => {
    mocks.publishedContent.mockResolvedValue([{ id: "cnt_public", status: "published" }]);

    const response = await getContent(request("/api/content?limit=20"));

    expect(response.status).toBe(200);
    expectPublic(response);
    expect(mocks.publishedContent).toHaveBeenCalledWith(20);
  });

  it("keeps empty and non-empty discovery search responses public", async () => {
    const empty = await getSearch(request("/api/search?q="));
    expect(empty.status).toBe(200);
    expectPublic(empty);
    expect(mocks.search).not.toHaveBeenCalled();

    mocks.search.mockResolvedValue([{ type: "server", id: "srv_result" }]);
    const result = await getSearch(request("/api/search?q=nexus&limit=10"));
    expect(result.status).toBe(200);
    expectPublic(result);
    expect(mocks.search).toHaveBeenCalledWith("nexus", 10, undefined);
  });

  it("keeps the official MTA directory explicitly public-cacheable", async () => {
    const response = await getDirectory(request("/api/servers/directory?limit=10"));

    expect(response.status).toBe(200);
    expectPublic(response);
    expect(response.headers.get("X-Request-Id")).toBeNull();
    expect(await response.json()).toMatchObject({
      servers: [],
      total: 0,
      limit: 10,
      isStale: false,
    });
  });
});
