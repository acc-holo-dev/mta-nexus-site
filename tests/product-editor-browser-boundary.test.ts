import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authService = vi.hoisted(() => ({
  getSession: vi.fn(async () => null),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({ authService }));
vi.mock("@nexus/security", () => ({
  can: () => false,
  consumeRateLimit: vi.fn(async () => ({ success: true })),
  generateId: () => "aud_a",
}));
vi.mock("../apps/web/src/lib/services/product-service", () => ({
  productService: {
    createProduct: vi.fn(),
    updateProductDetails: vi.fn(),
    getManagedProduct: vi.fn(),
  },
}));
vi.mock("../apps/web/src/lib/services/resource-management-service", () => ({
  resourceManagementService: {
    updateCompatibility: vi.fn(),
    saveVariants: vi.fn(),
    managedVariants: vi.fn(),
  },
}));
vi.mock("../apps/web/src/lib/services/resource-copy-service", () => ({
  resourceCopyService: { create: vi.fn(), preview: vi.fn() },
}));

import { POST as createResource } from "../apps/web/src/app/api/products/route";
import { PATCH as editResource } from "../apps/web/src/app/api/products/[id]/route";
import { POST as compatibility } from "../apps/web/src/app/api/products/[id]/compatibility/route";
import { POST as variants } from "../apps/web/src/app/api/products/[id]/variants/route";
import { POST as copyResource } from "../apps/web/src/app/api/products/[id]/copy/route";

const context = { params: Promise.resolve({ id: "prd_a" }) };
const mutations = [
  ["resource create", "POST", createResource, undefined],
  ["resource edit", "PATCH", editResource, context],
  ["compatibility", "POST", compatibility, context],
  ["variants", "POST", variants, context],
  ["resource copy", "POST", copyResource, context],
] as const;

function request(method: string, headers: Record<string, string> = {}) {
  return new NextRequest("https://nexus.test/api/products/prd_a", {
    method,
    headers: {
      cookie: "nexus_session=author",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ title: "Resource" }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://nexus.test");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  authService.getSession.mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("product editor handlers enforce the browser boundary independently of Proxy", () => {
  it.each(mutations)(
    "rejects a missing Origin on %s before session or body reads",
    async (_name, method, handler, routeContext) => {
      const input = request(method);
      const response = await handler(input, routeContext as never);
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "CSRF_REJECTED" });
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(input.bodyUsed).toBe(false);
      expect(authService.getSession).not.toHaveBeenCalled();
    },
  );

  it.each(mutations)(
    "rejects a cross-site Origin on %s even with a bearer token",
    async (_name, method, handler, routeContext) => {
      const input = request(method, {
        origin: "https://evil.test",
        authorization: "Bearer forged",
      });
      const response = await handler(input, routeContext as never);
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "CSRF_REJECTED" });
      expect(input.bodyUsed).toBe(false);
      expect(authService.getSession).not.toHaveBeenCalled();
    },
  );

  it.each(mutations)(
    "accepts a same-origin %s request and reaches session resolution",
    async (_name, method, handler, routeContext) => {
      const response = await handler(
        request(method, { origin: "https://nexus.test", "sec-fetch-site": "same-origin" }),
        routeContext as never,
      );
      expect(authService.getSession).toHaveBeenCalledOnce();
      const body = await response.json();
      expect(body.code).not.toBe("CSRF_REJECTED");
    },
  );
});
