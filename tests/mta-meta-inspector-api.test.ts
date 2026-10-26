import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "./browser-mutation-headers";
import { NextRequest } from "next/server";
import { metaInspectionLimits } from "../apps/web/src/lib/mta-meta-inspector";
import { getRateLimitPolicy } from "../packages/security/src/rate-limit-policy";

const state = vi.hoisted(() => ({
  user: null as null | {
    id: string;
    role: string;
  },
  allowed: true,
}));

const rate = vi.hoisted(() => vi.fn());

vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: {
    getSession: vi.fn(async () => state.user),
  },
}));

vi.mock("@nexus/security", () => ({
  can: vi.fn(() => state.allowed),
  consumeRateLimit: rate,
}));

import { POST } from "../apps/web/src/app/api/resources/inspect-meta/route";

function request(
  body = "<meta><info name=\"NEXUS\" /></meta>",
  contentType = "text/plain; charset=utf-8",
  extraHeaders: Record<string, string> = {},
) {
  const value = new NextRequest(
    "https://nexus.test/api/resources/inspect-meta",
    {
      method: "POST",
      headers: {
        ...browserMutationHeaders(),
        "content-type": contentType,
        cookie: "nexus_session=test-session",
        ...extraHeaders,
      },
      body,
    },
  );
  return value;
}

function expectPrivate(response: Response) {
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("Vary")).toBe("Cookie");
}

describe("resource meta inspector HTTP behavior", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    stubBrowserMutationOrigin();
    vi.clearAllMocks();
    state.user = {
      id: "usr_inspector",
      role: "developer",
    };
    state.allowed = true;
    rate.mockResolvedValue({ success: true });
  });

  it("uses a dedicated bounded inspection rate limit", () => {
    expect(getRateLimitPolicy("resourceInspection")).toEqual({
      limit: 30,
      windowSeconds: 60,
    });
  });

  it("requires authentication and product-create capability", async () => {
    state.user = null;
    const anonymous = await POST(request());
    expect(anonymous.status).toBe(401);
    expectPrivate(anonymous);
    expect(rate).not.toHaveBeenCalled();

    state.user = { id: "usr_inspector", role: "user" };
    state.allowed = false;
    const forbidden = await POST(request());
    expect(forbidden.status).toBe(403);
    expectPrivate(forbidden);
    expect(rate).not.toHaveBeenCalled();
  });

  it("enforces the dedicated rate limit before reading meta.xml", async () => {
    rate.mockResolvedValue({ success: false });
    const value = request();
    const read = vi.spyOn(value, "text");

    const response = await POST(value);

    expect(response.status).toBe(429);
    expectPrivate(response);
    expect(rate).toHaveBeenCalledWith(
      "resourceInspection",
      "usr_inspector",
    );
    expect(read).not.toHaveBeenCalled();
  });

  it("rejects unsupported media types and oversized Content-Length before body parsing", async () => {
    const unsupported = request("<meta />", "application/xml");
    const unsupportedRead = vi.spyOn(unsupported, "text");
    const wrongType = await POST(unsupported);
    expect(wrongType.status).toBe(415);
    expectPrivate(wrongType);
    expect(unsupportedRead).not.toHaveBeenCalled();

    const oversized = request(
      "<meta />",
      "text/plain",
      {
        "content-length": String(metaInspectionLimits.maxBytes + 1),
      },
    );
    const oversizedRead = vi.spyOn(oversized, "text");
    const tooLarge = await POST(oversized);
    expect(tooLarge.status).toBe(413);
    expectPrivate(tooLarge);
    expect(await tooLarge.json()).toMatchObject({
      maxBytes: metaInspectionLimits.maxBytes,
    });
    expect(oversizedRead).not.toHaveBeenCalled();
  });

  it("returns structural inspection only and never a trust verdict", async () => {
    const response = await POST(
      request(
        `<meta>
          <info name="NEXUS" version="1.0.0" type="script" />
          <script src="server.lua" />
        </meta>`,
      ),
    );

    expect(response.status).toBe(200);
    expectPrivate(response);
    const body = await response.json();
    expect(body.securityVerdict).toBeNull();
    expect(body.inspection).toMatchObject({
      root: "meta",
      summary: {
        scriptCount: 1,
        serverScripts: 1,
      },
    });
    expect(body.note).toContain(
      "not a malware, trust, or archive-integrity verdict",
    );
  });
});
