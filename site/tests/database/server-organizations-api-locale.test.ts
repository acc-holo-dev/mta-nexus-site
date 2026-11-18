import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { serverOrganizationsApiCopy } from "../../src/features/servers/server-organizations-api-copy";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  list: vi.fn(),
}));

vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: {
    getSession: mocks.getSession,
  },
}));

vi.mock("@nexus/db", () => ({
  organizationRepository: {
    listServerManageableByUser: mocks.list,
  },
}));

import { GET } from "../../src/app/api/workspace/server-organizations/route";

function request(locale: "en" | "ru") {
  return new NextRequest("https://nexus.test/api/workspace/server-organizations", {
    headers: { cookie: `nexus_session=tok;nexus_locale=${locale}` },
  });
}

describe("server organizations API locale envelope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ id: "usr_orgs" });
    mocks.list.mockResolvedValue([]);
  });

  it("returns bilingual 401 and 503 from nexus_locale", async () => {
    mocks.getSession.mockResolvedValueOnce(null);
    const unauth = await GET(request("ru"));
    expect(unauth.status).toBe(401);
    expect(await unauth.json()).toMatchObject({
      error: serverOrganizationsApiCopy("ru").authenticationRequired,
    });
    expect(mocks.list).not.toHaveBeenCalled();

    mocks.list.mockRejectedValueOnce(new Error("private"));
    const unavailable = await GET(request("en"));
    expect(unavailable.status).toBe(503);
    expect(await unavailable.json()).toMatchObject({
      error: serverOrganizationsApiCopy("en").unavailable,
    });
  });
});
