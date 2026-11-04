import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "./browser-mutation-headers";

const state = vi.hoisted(() => ({
  user: null as null | { id: string; role: string },
  canModerate: false,
}));

const mocks = vi.hoisted(() => ({
  listPublished: vi.fn(),
  createWithAudit: vi.fn(),
  findOrganization: vi.fn(),
  memberships: vi.fn(),
  findProduct: vi.fn(),
  rateLimit: vi.fn(),
  can: vi.fn(),
}));

vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: vi.fn(async () => state.user) },
}));

vi.mock("@nexus/db", () => ({
  contentRepository: {
    listPublished: mocks.listPublished,
    createWithAudit: mocks.createWithAudit,
  },
  organizationRepository: {
    findById: mocks.findOrganization,
    listUserMemberships: mocks.memberships,
  },
  productRepository: { findById: mocks.findProduct },
}));

vi.mock("../apps/web/src/lib/services/server-service", () => ({
  serverService: {
    getServerById: vi.fn(),
    canManageServer: vi.fn(),
  },
}));

vi.mock("../apps/web/src/lib/services/product-service", () => ({
  productService: { canManageProduct: vi.fn() },
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: mocks.rateLimit,
  generateId: vi.fn((prefix: string) => `${prefix}_test`),
  can: mocks.can,
}));

import { GET, POST } from "../apps/web/src/app/api/content/route";

function request(body: Record<string, unknown>, token = "session") {
  const req = new NextRequest("http://nexus.test/api/content", {
    method: "POST",
    headers: { ...browserMutationHeaders(), "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (token) req.cookies.set("nexus_session", token);
  return req;
}

function body(overrides: Record<string, unknown> = {}) {
  return {
    title: "NEXUS content",
    slug: "nexus-content",
    body: "Long enough body for content validation.",
    type: "article",
    tags: [],
    ...overrides,
  };
}

describe("community content API behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubBrowserMutationOrigin();
    state.user = { id: "usr_writer", role: "developer" };
    state.canModerate = false;
    mocks.rateLimit.mockResolvedValue({ success: true });
    mocks.can.mockImplementation(() => state.canModerate);
    mocks.listPublished.mockResolvedValue([]);
    mocks.memberships.mockResolvedValue([]);
    mocks.createWithAudit.mockImplementation(async (data) => ({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects unsupported media and oversized content before persistence", async () => {
    const unsupported = await POST(
      new NextRequest("http://nexus.test/api/content", {
        method: "POST",
        headers: {
          ...browserMutationHeaders(),
          cookie: "nexus_session=session",
          "content-type": "text/plain",
        },
        body: "{}",
      }),
    );
    expect(unsupported.status).toBe(415);
    expect(unsupported.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.rateLimit).not.toHaveBeenCalled();
    const oversized = await POST(request(body({ body: "x".repeat(128 * 1024) })));
    expect(oversized.status).toBe(413);
    expect(oversized.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.createWithAudit).not.toHaveBeenCalled();
  });

  it("accepts a 20,000-character Unicode article within the workspace byte budget", async () => {
    const article = "😀".repeat(20_000);
    const response = await POST(request(body({ body: article })));
    expect(response.status).toBe(201);
    expect(mocks.createWithAudit).toHaveBeenCalledWith(
      expect.objectContaining({ body: article }),
      expect.anything(),
      "session",
    );
  });

  it("bounds public reads and avoids caching revocable associations", async () => {
    const response = await GET(new NextRequest("http://nexus.test/api/content?limit=999"));

    expect(response.status).toBe(200);
    expect(mocks.listPublished).toHaveBeenCalledWith(100);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Request-Id")).toBeNull();
  });

  it("keeps authenticated creation private and rejects anonymous callers", async () => {
    state.user = null;
    const response = await POST(request(body(), ""));

    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Vary")).toBe("Cookie");
    expect(response.headers.get("X-Request-Id")).toMatch(/^[0-9a-f-]{20,}$/u);
    expect(mocks.createWithAudit).not.toHaveBeenCalled();
  });

  it("enforces creation rate limits before persistence", async () => {
    mocks.rateLimit.mockResolvedValue({ success: false });
    const response = await POST(request(body()));

    expect(response.status).toBe(429);
    expect(mocks.rateLimit).toHaveBeenCalledWith("contentCreation", "usr_writer");
    expect(mocks.createWithAudit).not.toHaveBeenCalled();
  });

  it("downgrades a non-moderator editorial publication request to draft", async () => {
    const response = await POST(request(body({ status: "published", type: "article" })));

    expect(response.status).toBe(201);
    expect(mocks.createWithAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        authorId: "usr_writer",
        status: "draft",
        type: "article",
      }),
      expect.objectContaining({
        action: "content.created",
        details: expect.objectContaining({ status: "draft" }),
      }),
      "session",
    );
  });

  it.each(["post", "question"] as const)(
    "publishes community %s server-side without trusting a client status",
    async (type) => {
      const response = await POST(request(body({ type, status: "draft" })));

      expect(response.status).toBe(201);
      expect(mocks.createWithAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "published",
          type,
          publishedAt: expect.any(Date),
        }),
        expect.anything(),
        "session",
      );
    },
  );

  it("allows moderator editorial publication", async () => {
    state.canModerate = true;
    const response = await POST(request(body({ status: "published", type: "news" })));

    expect(response.status).toBe(201);
    expect(mocks.createWithAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "published",
        type: "news",
        publishedAt: expect.any(Date),
      }),
      expect.anything(),
      "session",
    );
  });

  it("returns a private retryable conflict for a rolled-back database deadlock", async () => {
    mocks.createWithAudit.mockRejectedValueOnce({ cause: { code: "40P01" } });
    const response = await POST(request(body()));
    expect(response.status).toBe(409);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toMatchObject({ code: "CONTENT_CREATION_RETRY" });
  });

  it("rejects a linked organization the actor does not manage", async () => {
    mocks.findOrganization.mockResolvedValue({
      id: "org_1",
      ownerId: "usr_owner",
    });
    const response = await POST(request(body({ organizationId: "org_1" })));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "You do not manage this organization",
    });
    expect(mocks.memberships).toHaveBeenCalledWith("usr_writer");
    expect(mocks.createWithAudit).not.toHaveBeenCalled();
  });
});
