import { AppError } from "@nexus/domain";
import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  actor: { id: "usr_a", role: "user" } as { id: string; role: string } | null,
  rate: vi.fn(),
  command: vi.fn(),
  page: vi.fn(),
  detail: vi.fn(),
  history: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.actor },
}));
vi.mock("@nexus/security", () => ({
  consumeRateLimit: state.rate,
  generateId: (prefix: string) => `${prefix}_a`,
}));
vi.mock("@nexus/db", () => ({
  libraryCollectionsRepository: {
    command: state.command,
    page: state.page,
    detail: state.detail,
    history: state.history,
  },
}));

import { GET as candidates } from "../apps/web/src/app/api/library/collections/[id]/candidates/route";
import { GET as history } from "../apps/web/src/app/api/library/collections/[id]/history/route";
import {
  POST as command,
  GET as detail,
} from "../apps/web/src/app/api/library/collections/[id]/route";
import { POST as create, GET as list } from "../apps/web/src/app/api/library/collections/route";

const context = { params: Promise.resolve({ id: "lcol_a" }) },
  base = "/api/library/collections",
  requestId = "67ca0352-de64-4af9-9e54-7d3c56fe8d89";
const request = (path: string, init?: ConstructorParameters<typeof NextRequest>[1]) =>
  new NextRequest(`https://nexus.test${path}`, init);
const post = (
  body: unknown = { requestId, action: "create", name: "Core" },
  path = base,
  headers: Record<string, string> = { "content-type": "application/json" },
) => request(path, { method: "POST", body: JSON.stringify(body), headers });
beforeEach(() => {
  vi.clearAllMocks();
  state.actor = { id: "usr_a", role: "user" };
  state.rate.mockResolvedValue({ success: true });
  state.command.mockResolvedValue({ receipt: { id: "lcr_a" }, replayed: false });
  state.page.mockResolvedValue({ items: [] });
  state.detail.mockResolvedValue({ items: [] });
  state.history.mockResolvedValue({ items: [] });
});
it("requires a signed-in account for all six private operations", async () => {
  state.actor = null;
  for (const [handler, path] of [
    [list, base],
    [detail, `${base}/lcol_a`],
    [candidates, `${base}/lcol_a/candidates`],
    [history, `${base}/lcol_a/history`],
  ] as const)
    expect((await handler(request(path), context)).status).toBe(401);
  expect((await create(post())).status).toBe(401);
  expect((await command(post({}, `${base}/lcol_a`), context)).status).toBe(401);
  expect(state.command).not.toHaveBeenCalled();
});
it("fixes actor identity and returns private uncached records", async () => {
  const response = await create(post());
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(state.command).toHaveBeenCalledWith({
    userId: "usr_a",
    command: { requestId, action: "create", name: "Core" },
    collectionId: undefined,
    newCollectionId: "lcol_a",
    receiptId: "lcr_a",
    auditId: "aud_a",
  });
  expect(state.rate).toHaveBeenCalledWith("contentCreation", "usr_a");
});
it("scopes reads and pagination to the account, not body or query identities", async () => {
  expect((await list(request(`${base}?page=2&status=archived`))).status).toBe(200);
  expect(state.page).toHaveBeenCalledWith("usr_a", 2, "archived");
  expect(
    (await candidates(request(`${base}/lcol_a/candidates?page=3&q=core`), context)).status,
  ).toBe(200);
  expect(state.detail).toHaveBeenCalledWith("usr_a", "lcol_a", 3, "core", true);
  expect((await history(request(`${base}/lcol_a/history?page=2`), context)).status).toBe(200);
  expect(state.history).toHaveBeenCalledWith("usr_a", "lcol_a", 2);
  expect(state.rate).toHaveBeenCalledWith("resourceInspection", "usr_a");
});
it.each(["userId", "organizationId", "permission", "price", "status", "entitlement"])(
  "rejects body override %s",
  async (field) => {
    expect(
      (await create(post({ requestId, action: "create", name: "Core", [field]: "other" }))).status,
    ).toBe(400);
    expect(state.command).not.toHaveBeenCalled();
  },
);
it("forbids create commands on existing ids and resource commands on collection root", async () => {
  expect((await command(post(undefined, `${base}/lcol_a`), context)).status).toBe(400);
  expect(
    (await create(post({ requestId, action: "add", expectedRevision: 1, productId: "prd_a" })))
      .status,
  ).toBe(400);
  expect(state.command).not.toHaveBeenCalled();
});
it("rejects cross-site mutations, wrong content types and oversized bodies", async () => {
  expect(
    (
      await create(
        post(undefined, base, {
          "content-type": "application/json",
          "sec-fetch-site": "cross-site",
        }),
      )
    ).status,
  ).toBe(403);
  expect((await create(post(undefined, base, { "content-type": "text/plain" }))).status).toBe(415);
  expect((await create(post({ requestId, action: "create", name: "x".repeat(3000) }))).status).toBe(
    413,
  );
  expect(state.command).not.toHaveBeenCalled();
});
it("rejects unknown, duplicate and mutation query controls", async () => {
  for (const [handler, path] of [
    [list, base],
    [detail, `${base}/lcol_a`],
    [candidates, `${base}/lcol_a/candidates`],
    [history, `${base}/lcol_a/history`],
  ] as const) {
    expect((await handler(request(`${path}?userId=other`), context)).status).toBe(400);
    expect((await handler(request(`${path}?page=1&page=2`), context)).status).toBe(400);
  }
  expect((await create(post(undefined, `${base}?page=1`))).status).toBe(400);
  expect((await command(post({}, `${base}/lcol_a?userId=other`), context)).status).toBe(400);
  expect(state.command).not.toHaveBeenCalled();
});
it("rate limits reads and commands before accessing data", async () => {
  state.rate.mockResolvedValue({ success: false });
  expect((await create(post())).status).toBe(429);
  expect((await detail(request(`${base}/lcol_a`), context)).status).toBe(429);
  expect(state.command).not.toHaveBeenCalled();
  expect(state.detail).not.toHaveBeenCalled();
});
it("returns conflicts and masked missing resources without internal fields", async () => {
  state.command.mockRejectedValue(
    new AppError("secret database detail", 409, "COLLECTION_CONFLICT"),
  );
  const response = await command(
    post(
      { requestId, action: "remove", productId: "prd_a", expectedRevision: 1 },
      `${base}/lcol_a`,
    ),
    context,
  );
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ code: "COLLECTION_CONFLICT" });
});
it("accepts a canonical private batch larger than the old body limit", async () => {
  const productIds = Array.from(
    { length: 20 },
    (_, i) => `prd_${String(i).padStart(2, "0")}_${"a".repeat(153)}`,
  ).reverse();
  const response = await command(
    post({ requestId, action: "add-many", productIds, expectedRevision: 2 }, `${base}/lcol_a`),
    context,
  );
  expect(response.status).toBe(200);
  expect(state.command).toHaveBeenCalledWith(
    expect.objectContaining({
      userId: "usr_a",
      collectionId: "lcol_a",
      command: {
        requestId,
        action: "add-many",
        productIds: [...productIds].sort(),
        expectedRevision: 2,
      },
    }),
  );
  expect(response.headers.get("cache-control")).toContain("no-store");
});
it("rejects oversized batches and injected ownership before repository writes", async () => {
  for (const body of [
    {
      requestId,
      action: "remove-many",
      expectedRevision: 2,
      productIds: Array.from({ length: 21 }, (_, i) => `prd_${i}`),
    },
    {
      requestId,
      action: "add-many",
      expectedRevision: 2,
      productIds: ["prd_a"],
      userId: "usr_other",
    },
    { requestId, action: "remove-many", expectedRevision: 2, productIds: ["prd_a", "prd_a"] },
  ])
    expect((await command(post(body, `${base}/lcol_a`), context)).status).toBe(400);
  expect(state.command).not.toHaveBeenCalled();
});
