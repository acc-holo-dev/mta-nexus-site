import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: { id: "usr_actor" } as null | { id: string },
  list: vi.fn(),
}));

vi.mock("@nexus/db", () => ({
  organizationRepository: { listServerManageableByUser: state.list },
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: vi.fn(async () => state.user) },
}));

import { GET } from "../apps/web/src/app/api/workspace/server-organizations/route";

const request = () => new NextRequest("https://nexus.test/api/workspace/server-organizations", {
  headers: { cookie: "nexus_session=valid" },
});

beforeEach(() => {
  vi.clearAllMocks();
  state.user = { id: "usr_actor" };
  state.list.mockResolvedValue([
    { id: "org_owned", name: "Owner organization", slug: "owner-organization" },
  ]);
});
afterEach(() => vi.restoreAllMocks());

function expectPrivate(response: Response) {
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{20,}$/u);
}

describe("private server organization options endpoint", () => {
  it("returns only caller-scoped organizations without shared caching", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expectPrivate(response);
    expect(state.list).toHaveBeenCalledExactlyOnceWith("usr_actor");
    expect(await response.json()).toEqual({
      organizations: [
        { id: "org_owned", name: "Owner organization", slug: "owner-organization" },
      ],
    });
  });

  it("refuses anonymous access before querying organization data", async () => {
    state.user = null;
    const response = await GET(request());
    expect(response.status).toBe(401);
    expectPrivate(response);
    expect(state.list).not.toHaveBeenCalled();
    expect(await response.json()).not.toHaveProperty("organizations");
  });

  it("fails closed without leaking database errors to clients", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    state.list.mockRejectedValueOnce(new Error("private database detail"));
    const response = await GET(request());
    expect(response.status).toBe(503);
    expectPrivate(response);
    expect(await response.json()).toEqual({
      error: "Organization options temporarily unavailable",
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain("private database detail");
  });
});
