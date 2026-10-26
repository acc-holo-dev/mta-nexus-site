import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authService = vi.hoisted(() => ({
  getSession: vi.fn(async () => null),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({ authService }));
vi.mock("@nexus/security", () => ({
  consumeRateLimit: vi.fn(async () => ({ success: true })),
  generateId: () => "aud_a",
}));
vi.mock("../apps/web/src/lib/services/library-collections-service", () => ({
  libraryCollectionsService: {
    command: vi.fn(),
    membershipBatch: vi.fn(),
    importPreview: vi.fn(),
    reconcilePreview: vi.fn(),
    page: vi.fn(),
    detail: vi.fn(),
    resourceMemberships: vi.fn(),
  },
}));
vi.mock("../apps/web/src/lib/services/library-selection-batches-service", () => ({
  librarySelectionBatchesService: {
    command: vi.fn(),
    preview: vi.fn(),
  },
}));
vi.mock("../apps/web/src/lib/services/resource-release-watches-service", () => ({
  resourceReleaseWatchesService: {
    collectionPage: vi.fn(),
    enableCollectionBatch: vi.fn(),
  },
}));

import { POST as createCollection } from "../apps/web/src/app/api/library/collections/route";
import { POST as commandCollection } from "../apps/web/src/app/api/library/collections/[id]/route";
import { POST as membershipBatch } from "../apps/web/src/app/api/library/[id]/collections/route";
import { POST as importPreview } from "../apps/web/src/app/api/library/collections/[id]/import-preview/route";
import { POST as reconcilePreview } from "../apps/web/src/app/api/library/collections/[id]/reconcile-preview/route";
import { POST as applyVersions } from "../apps/web/src/app/api/library/collections/[id]/versions/route";
import { POST as previewVersions } from "../apps/web/src/app/api/library/collections/[id]/versions/preview/route";
import { POST as enableWatches } from "../apps/web/src/app/api/library/collections/[id]/watches/route";

const context = { params: Promise.resolve({ id: "lcol_a" }) };
const mutations = [
  ["collection create", createCollection, undefined],
  ["collection command", commandCollection, context],
  ["collection membership", membershipBatch, context],
  ["collection import preview", importPreview, context],
  ["collection reconcile preview", reconcilePreview, context],
  ["collection version apply", applyVersions, context],
  ["collection version preview", previewVersions, context],
  ["collection watch enrollment", enableWatches, context],
] as const;

function request(headers: Record<string, string> = {}) {
  return new NextRequest("https://nexus.test/api/library/collections", {
    method: "POST",
    headers: {
      cookie: "nexus_session=owner",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ requestId: "67ca0352-de64-4af9-9e54-7d3c56fe8d89", action: "create" }),
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

describe("library collection handlers enforce the browser boundary independently of Proxy", () => {
  it.each(mutations)(
    "rejects a missing Origin on %s before session or body reads",
    async (_name, handler, routeContext) => {
      const input = request();
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
    async (_name, handler, routeContext) => {
      const input = request({
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
    async (_name, handler, routeContext) => {
      const response = await handler(
        request({ origin: "https://nexus.test", "sec-fetch-site": "same-origin" }),
        routeContext as never,
      );
      expect(authService.getSession).toHaveBeenCalledOnce();
      const body = await response.json();
      expect(body.code).not.toBe("CSRF_REJECTED");
    },
  );
});
