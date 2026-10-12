import { AppError } from "@nexus/domain";
import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  session: vi.fn(),
  profile: vi.fn(),
  organization: vi.fn(),
  rate: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: mock.session },
}));
vi.mock("../apps/web/src/lib/services/profile-change-history-service", () => ({
  profileChangeHistoryService: { page: mock.profile },
}));
vi.mock("../apps/web/src/lib/services/organization-governance-service", () => ({
  organizationGovernanceService: { history: mock.organization },
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: mock.rate }));

import { GET as profileExport } from "../apps/web/src/app/api/account/profile/history/export/route";
import { GET as profile } from "../apps/web/src/app/api/account/profile/history/route";
import { GET as organizationExport } from "../apps/web/src/app/api/workspace/organizations/[id]/activity/export/route";
import { GET as organization } from "../apps/web/src/app/api/workspace/organizations/[id]/activity/route";

const stamp = "2026-10-12T00:00:00.123456Z",
  params = { params: Promise.resolve({ id: "org" }) };
const empty = {
  username: "owner",
  until: stamp,
  period: "all",
  group: "all",
  items: [],
  hasMore: false,
  nextCursor: null,
};
function request(path: string, query = "", locale = "en") {
  return new NextRequest(`https://nexus.test${path}${query}`, {
    headers: { cookie: `nexus_session=token;nexus_locale=${locale}` },
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  mock.session.mockResolvedValue({ id: "owner", role: "user" });
  mock.profile.mockResolvedValue(empty);
  mock.organization.mockResolvedValue({
    organization: { id: "org", name: "Team", slug: "team" },
    until: stamp,
    period: "all",
    group: "all",
    query: "",
    items: [],
    hasMore: false,
    nextCursor: null,
  });
  mock.rate.mockResolvedValue({ success: true });
});
it("binds profile reads to the session and rejects supplied foreign identity", async () => {
  const response = await profile(
    request("/api/account/profile/history", "?period=7&group=privacy"),
  );
  expect(response.status).toBe(200);
  expect(mock.profile).toHaveBeenCalledExactlyOnceWith(
    "owner",
    expect.objectContaining({ period: "7", group: "privacy" }),
  );
  expect((await profile(request("/api/account/profile/history", "?actorId=foreign"))).status).toBe(
    400,
  );
  expect(mock.profile).toHaveBeenCalledOnce();
});
it.each(["profile", "profileExport", "organization", "organizationExport"])(
  "keeps %s authentication boundaries private and does no history reads anonymously",
  async (kind) => {
    mock.session.mockResolvedValue(null);
    const req = request("/api/account/profile/history");
    const response =
      kind === "profile"
        ? await profile(req)
        : kind === "profileExport"
          ? await profileExport(req)
          : kind === "organization"
            ? await organization(req, params)
            : await organizationExport(req, params);
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(response.headers.has("content-disposition")).toBe(false);
    expect(mock.profile).not.toHaveBeenCalled();
    expect(mock.organization).not.toHaveBeenCalled();
  },
);
it.each(["en", "ru"])(
  "returns a bounded private profile export retaining its cutoff in %s",
  async (locale) => {
    const response = await profileExport(
      request(
        "/api/account/profile/history/export",
        `?until=${stamp}&period=30&group=professional`,
        locale,
      ),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="profile-history.json"',
    );
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(mock.profile).toHaveBeenCalledWith(
      "owner",
      expect.objectContaining({ until: stamp, period: "30", group: "professional" }),
    );
    expect(await response.json()).toEqual(empty);
  },
);
it("passes exact current organization filters and checks authority again for exports", async () => {
  const response = await organizationExport(
    request(
      "/api/workspace/organizations/org/activity/export",
      `?period=90&group=team&q=Owner&until=${stamp}`,
    ),
    params,
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("content-disposition")).toBe(
    'attachment; filename="organization-activity.json"',
  );
  expect(mock.organization).toHaveBeenCalledExactlyOnceWith(
    "org",
    { id: "owner", role: "user" },
    undefined,
    expect.objectContaining({ period: "90", group: "team", query: "Owner", until: stamp }),
  );
  mock.organization.mockRejectedValue(new AppError("Private revoked membership", 403, "FORBIDDEN"));
  const denied = await organizationExport(
    request("/api/workspace/organizations/org/activity/export"),
    params,
  );
  expect(denied.status).toBe(403);
  expect(denied.headers.has("content-disposition")).toBe(false);
  expect(await denied.text()).not.toContain("Private revoked");
});
it.each(["profile", "organization"])(
  "rate-limits %s history before entering storage",
  async (kind) => {
    mock.rate.mockResolvedValue({ success: false });
    const req = request("/api/account/profile/history");
    expect((kind === "profile" ? await profile(req) : await organization(req, params)).status).toBe(
      429,
    );
    expect(mock.profile).not.toHaveBeenCalled();
    expect(mock.organization).not.toHaveBeenCalled();
  },
);
it.each(["?period=7&period=30", "?group=admin", "?until=invalid", "?cursor=x&before=y", "?page=1"])(
  "rejects malformed organization export query %s before storage",
  async (query) => {
    const response = await organizationExport(
      request("/api/workspace/organizations/org/activity/export", query),
      params,
    );
    expect(response.status).toBe(400);
    expect(response.headers.has("content-disposition")).toBe(false);
    expect(mock.organization).not.toHaveBeenCalled();
  },
);
it("redacts unexpected storage errors from exports and localizes the response", async () => {
  mock.profile.mockRejectedValue(Error("postgres-private-password"));
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const response = await profileExport(request("/api/account/profile/history/export", "", "ru"));
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(text).toContain("Не удалось");
    expect(text).not.toContain("postgres-private");
  } finally {
    error.mockRestore();
  }
});
it("enforces the export byte limit with safe private errors", async () => {
  mock.profile.mockResolvedValue({ body: "x".repeat(512 * 1024) });
  const response = await profileExport(request("/api/account/profile/history/export"));
  expect(response.status).toBe(503);
  expect(response.headers.has("content-disposition")).toBe(false);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(await response.json()).toMatchObject({ code: "INTERNAL_ERROR" });
});
