import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import {
  BROWSER_ROUTE_ADAPTER,
  withBrowserMutation,
} from "../apps/web/src/lib/browser-route-adapter";
import {
  LICENSE_BEARER_ROUTE_ADAPTER,
  withLicenseBearerRoute,
} from "../apps/web/src/lib/license-bearer-route-adapter";

const licenseRuntimeRequest = vi.hoisted(() =>
  vi.fn(async (_request: NextRequest, operation: (digest: string) => Promise<unknown | null>) => {
    const result = await operation("digest_test");
    return NextResponse.json(result ?? { valid: false }, { status: result ? 200 : 401 });
  }),
);

vi.mock("../apps/web/src/lib/license-runtime-http", () => ({
  licenseRuntimeRequest,
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://nexus.test");
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("route adapter markers", () => {
  it("keeps the stable inventory ids", () => {
    expect(BROWSER_ROUTE_ADAPTER).toBe("browser-csrf-v1");
    expect(LICENSE_BEARER_ROUTE_ADAPTER).toBe("license-bearer-v1");
  });
});

describe("withBrowserMutation", () => {
  it("rejects cross-origin mutations before the handler runs", async () => {
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const route = withBrowserMutation(handler);
    const request = new NextRequest("https://nexus.test/api/demo", {
      method: "POST",
      headers: { origin: "https://evil.test" },
    });
    const response = await route(request);
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "CSRF_REJECTED" });
    expect(handler).not.toHaveBeenCalled();
    expect(request.bodyUsed).toBe(false);
  });

  it("forwards same-origin requests including route context", async () => {
    const handler = vi.fn(async (_request: NextRequest, context: { params: Promise<{ id: string }> }) => {
      const { id } = await context.params;
      return NextResponse.json({ id });
    });
    const route = withBrowserMutation(handler);
    const response = await route(
      new NextRequest("https://nexus.test/api/products/p1/builds", {
        method: "POST",
        headers: { origin: "https://nexus.test" },
      }),
      { params: Promise.resolve({ id: "p1" }) },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "p1" });
    expect(handler).toHaveBeenCalledOnce();
  });
});

describe("withLicenseBearerRoute", () => {
  it("uses the independent bearer runtime boundary without browser CSRF", async () => {
    const operation = vi.fn(async (digest: string) => ({ digest, valid: true }));
    const route = withLicenseBearerRoute(operation);
    const request = new NextRequest("https://nexus.test/api/licenses/check", {
      method: "POST",
      headers: { authorization: "Bearer runtime-token", "content-type": "application/json" },
      body: "{}",
    });
    const response = await route(request);
    expect(licenseRuntimeRequest).toHaveBeenCalledOnce();
    expect(operation).toHaveBeenCalledWith("digest_test", request);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ digest: "digest_test", valid: true });
  });
});
