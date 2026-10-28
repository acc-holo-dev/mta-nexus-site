import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "./browser-mutation-headers";

const mocks = vi.hoisted(() => ({
  user: { id: "mod_1" } as { id: string } | null,
  authorized: true,
  rate: vi.fn(),
  resolve: vi.fn(),
  findById: vi.fn(),
}));

vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => mocks.user },
}));
vi.mock("../apps/web/src/lib/services/product-service", () => ({ productService: {} }));
vi.mock("../apps/web/src/lib/services/content-service", () => ({ contentService: {} }));
vi.mock("@nexus/security", () => ({
  can: () => mocks.authorized,
  consumeRateLimit: mocks.rate,
  generateId: () => "aud_test",
}));
vi.mock("@nexus/db", () => ({
  reportRepository: { resolve: mocks.resolve, findById: mocks.findById },
  productRepository: {},
  verificationRepository: {},
}));

import { POST } from "../apps/web/src/app/api/admin/actions/route";

function request(action = "resolve", notes = "Reviewed supporting evidence") {
  const req = new NextRequest("https://nexus.test/api/admin/actions", {
    method: "POST",
    body: JSON.stringify({ targetType: "report", targetId: "rpt_1", action, notes }),
    headers: browserMutationHeaders({ "Content-Type": "application/json" }),
  });
  req.cookies.set("nexus_session", "session");
  return req;
}

afterEach(() => {
  vi.unstubAllEnvs();
});
beforeEach(() => {
  stubBrowserMutationOrigin();
  mocks.user = { id: "mod_1" };
  mocks.authorized = true;
  mocks.rate.mockReset().mockResolvedValue({ success: true });
  mocks.resolve.mockReset().mockResolvedValue({ id: "rpt_1", status: "resolved" });
  mocks.findById.mockReset();
});

describe("report decisions over HTTP", () => {
  it("does not resolve a report when the initiating session cookie is missing", async () => {
    const req = new NextRequest("https://nexus.test/api/admin/actions", {
      method: "POST",
      body: JSON.stringify({
        targetType: "report",
        targetId: "rpt_1",
        action: "resolve",
        notes: "Reviewed supporting evidence",
      }),
      headers: browserMutationHeaders({ "Content-Type": "application/json" }),
    });
    expect((await POST(req)).status).toBe(401);
    expect(mocks.resolve).not.toHaveBeenCalled();
  });

  it("blocks unauthorized decisions and empty reasons before writing", async () => {
    mocks.authorized = false;
    expect((await POST(request())).status).toBe(403);
    mocks.authorized = true;
    expect((await POST(request("dismiss", "  "))).status).toBe(400);
    expect(mocks.resolve).not.toHaveBeenCalled();
  });

  it("commits each outcome with a matching audit event and a private response", async () => {
    const response = await POST(request("dismiss", "  Duplicated claim  "));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Vary")).toBe("Cookie");
    expect(await response.json()).toEqual({ success: true, action: "dismiss", targetId: "rpt_1" });
    expect(mocks.resolve).toHaveBeenCalledWith(
      "rpt_1",
      "dismissed",
      "Duplicated claim",
      expect.objectContaining({
        actorId: "mod_1",
        action: "admin.dismiss",
        details: { notes: "Duplicated claim" },
      }),
      "session",
    );
  });

  it("distinguishes a missing report from a decision already made", async () => {
    mocks.resolve.mockResolvedValue(null);
    mocks.findById
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "rpt_1", status: "resolved" });
    expect((await POST(request())).status).toBe(404);
    const stale = await POST(request());
    expect(stale.status).toBe(409);
    expect((await stale.json()).code).toBe("REPORT_STATE_CHANGED");
  });
});
