import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authService = vi.hoisted(() => ({
  getSession: vi.fn(async () => null),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({ authService }));
vi.mock("@nexus/security", () => ({
  can: () => false,
  consumeRateLimit: vi.fn(async () => ({ success: true })),
}));
vi.mock("@nexus/db", () => ({ resourceMediaRepository: {} }));
vi.mock("@nexus/storage", () => ({ storageService: {} }));
vi.mock("../apps/web/src/lib/services/resource-media-service", () => ({
  resourceMediaService: {},
}));

import {
  PATCH as mediaPatch,
  POST as mediaUpload,
} from "../apps/web/src/app/api/products/[id]/media/route";
import { POST as inspectMeta } from "../apps/web/src/app/api/resources/inspect-meta/route";

const context = { params: Promise.resolve({ id: "prd_a" }) };
const mutations = [
  ["gallery upload", "POST", mediaUpload],
  ["gallery save", "PATCH", mediaPatch],
  ["meta.xml inspection", "POST", inspectMeta],
] as const;

function request(method: string, headers: Record<string, string> = {}) {
  return new NextRequest("https://nexus.test/api/uploads", {
    method,
    headers: {
      cookie: "nexus_session=author",
      "content-type": "text/plain",
      ...headers,
    },
    body: "<meta />",
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

describe("browser upload handlers enforce the browser boundary independently of Proxy", () => {
  it.each(mutations)(
    "rejects a missing Origin on %s before session or body reads",
    async (_name, method, handler) => {
      const input = request(method);
      const response = await handler(input, context);
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "CSRF_REJECTED" });
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(input.bodyUsed).toBe(false);
      expect(authService.getSession).not.toHaveBeenCalled();
    },
  );

  it.each(mutations)(
    "rejects a cross-site Origin on %s even with a bearer token",
    async (_name, method, handler) => {
      const input = request(method, {
        origin: "https://evil.test",
        authorization: "Bearer forged",
      });
      const response = await handler(input, context);
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "CSRF_REJECTED" });
      expect(input.bodyUsed).toBe(false);
      expect(authService.getSession).not.toHaveBeenCalled();
    },
  );

  it.each(mutations)(
    "accepts a same-origin %s request and reaches session resolution",
    async (_name, method, handler) => {
      const response = await handler(
        request(method, { origin: "https://nexus.test", "sec-fetch-site": "same-origin" }),
        context,
      );
      expect(authService.getSession).toHaveBeenCalledOnce();
      const body = await response.json();
      expect(body.code).not.toBe("CSRF_REJECTED");
    },
  );
});
