import { AppError } from "@nexus/domain";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "./browser-mutation-headers";

const state = vi.hoisted(() => ({
  actor: { id: "usr_a", role: "user" } as { id: string; role: string } | null,
  rate: vi.fn(),
  create: vi.fn(),
  page: vi.fn(),
  detail: vi.fn(),
  preview: vi.fn(),
  publish: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.actor },
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: state.rate, generateId: () => "evt_a" }));
vi.mock("@nexus/db", () => ({
  resourceCopiesRepository: {
    create: state.create,
    page: state.page,
    detail: state.detail,
    preview: state.preview,
  },
}));
vi.mock("@nexus/domain", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@nexus/domain")>()),
  eventBus: { publish: state.publish },
}));

import { GET as exportGET } from "../apps/web/src/app/api/products/[id]/copies/[receiptId]/export/route";
import { GET as detailGET } from "../apps/web/src/app/api/products/[id]/copies/[receiptId]/route";
import { GET as historyGET } from "../apps/web/src/app/api/products/[id]/copies/route";
import { POST, GET as previewGET } from "../apps/web/src/app/api/products/[id]/copy/route";
import { command, metadata, preview, receipt, receiptId, sourceId } from "./resource-copy-fixtures";

const context = { params: Promise.resolve({ id: sourceId, receiptId }) },
  base = `/api/products/${sourceId}`;
const request = (path: string, init?: ConstructorParameters<typeof NextRequest>[1]) =>
  new NextRequest(`https://nexus.test${path}`, init);
const post = (
  body: unknown = command,
  query = "",
  headers: Record<string, string> = {},
) =>
  request(`${base}/copy${query}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { ...browserMutationHeaders(), "content-type": "application/json", ...headers },
  });
afterEach(() => {
  vi.unstubAllEnvs();
});
beforeEach(() => {
  stubBrowserMutationOrigin();
  vi.clearAllMocks();
  state.actor = { id: "usr_a", role: "user" };
  state.rate.mockResolvedValue({ success: true });
  state.create.mockResolvedValue({ receipt, replayed: false, publisherId: "usr_original" });
  state.detail.mockResolvedValue({ receipt, targetStatus: "draft" });
  state.preview.mockResolvedValue(preview);
  state.page.mockResolvedValue({ copies: [] });
  state.publish.mockResolvedValue(undefined);
});
it("authenticates all five private HTTP operations", async () => {
  state.actor = null;
  for (const [handler, path] of [
    [previewGET, `${base}/copy`],
    [historyGET, `${base}/copies`],
    [detailGET, `${base}/copies/${receiptId}`],
    [exportGET, `${base}/copies/${receiptId}/export`],
  ] as const)
    expect((await handler(request(path), context)).status).toBe(401);
  expect((await POST(post(), context)).status).toBe(401);
  expect(state.create).not.toHaveBeenCalled();
});
it("validates commands, fixes actor identity and preserves publisher identity in the domain event", async () => {
  const response = await POST(post(), context);
  expect(response.status).toBe(200);
  expect(state.create).toHaveBeenCalledWith("usr_a", sourceId, command);
  expect(state.rate).toHaveBeenCalledWith("contentCreation", "usr_a");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(await response.json()).toEqual(JSON.parse(JSON.stringify({ receipt, replayed: false })));
  expect(state.publish.mock.calls[0]?.[0].payload.authorId).toBe("usr_original");
  for (const key of ["actorId", "organizationId", "price", "status", "metadata", "builds"])
    expect((await POST(post({ ...command, [key]: "bad" }), context)).status).toBe(400);
});
it("does not emit duplicate events on idempotent retries", async () => {
  state.create.mockResolvedValue({ receipt, replayed: true, publisherId: "usr_original" });
  expect((await POST(post(), context)).status).toBe(200);
  expect(state.publish).not.toHaveBeenCalled();
});
it("preserves committed success when optional event delivery fails", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  state.publish.mockRejectedValue(new Error("provider failure"));
  try {
    expect((await POST(post(), context)).status).toBe(200);
    expect(log).toHaveBeenCalledWith(expect.any(String), { productId: receipt.target.id });
  } finally {
    log.mockRestore();
  }
});
it("rejects cross-site mutations, oversized bodies, unknown queries and wrong content types", async () => {
  expect(
    (
      await POST(
        post(command, "", { "content-type": "application/json", "sec-fetch-site": "cross-site" }),
        context,
      )
    ).status,
  ).toBe(403);
  expect((await POST(post(command, "", { "content-type": "text/plain" }), context)).status).toBe(
    415,
  );
  expect((await POST(post({ ...command, title: "x".repeat(5000) }), context)).status).toBe(413);
  expect((await POST(post(command, "?actorId=other"), context)).status).toBe(400);
  expect(state.create).not.toHaveBeenCalled();
});
it("rate limits reads and mutations before repository access", async () => {
  state.rate.mockResolvedValue({ success: false });
  expect((await previewGET(request(`${base}/copy`), context)).status).toBe(429);
  expect((await historyGET(request(`${base}/copies`), context)).status).toBe(429);
  expect((await POST(post(), context)).status).toBe(429);
  expect(state.preview).not.toHaveBeenCalled();
  expect(state.create).not.toHaveBeenCalled();
});
it("bounds history and forbids actor/org overrides on all read surfaces", async () => {
  expect((await historyGET(request(`${base}/copies?page=2&days=7`), context)).status).toBe(200);
  expect(state.page).toHaveBeenCalledWith("usr_a", sourceId, 2, 7);
  for (const [handler, path] of [
    [previewGET, `${base}/copy`],
    [historyGET, `${base}/copies`],
    [detailGET, `${base}/copies/${receiptId}`],
    [exportGET, `${base}/copies/${receiptId}/export`],
  ] as const)
    expect((await handler(request(`${path}?organizationId=other`), context)).status).toBe(400);
  expect(state.rate).toHaveBeenCalledWith("resourceInspection", "usr_a");
});
it("exports only accessible frozen data and current state as private JSON", async () => {
  const response = await exportGET(request(`${base}/copies/${receiptId}/export`), context);
  expect(response.status).toBe(200);
  expect(response.headers.get("content-disposition")).toContain(receiptId);
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(await response.json()).toEqual(
    JSON.parse(
      JSON.stringify({ format: "nexus-resource-copy-v1", receipt, targetStatus: "draft" }),
    ),
  );
  state.detail.mockRejectedValue(new AppError("private details", 404, "NOT_FOUND"));
  const denied = await exportGET(request(`${base}/copies/${receiptId}/export`), context);
  expect(denied.status).toBe(404);
  expect(await denied.json()).toEqual({ code: "NOT_FOUND" });
});
it("does not expose internal failures and bounds the exported representation", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    state.create.mockRejectedValue(new Error("private SQL/storage secret"));
    const failed = await POST(post(), context);
    expect(failed.status).toBe(500);
    expect(await failed.text()).not.toContain("secret");
    state.detail.mockResolvedValue({
      receipt: { ...receipt, metadata: { ...metadata, description: "x".repeat(90 * 1024) } },
      targetStatus: "draft",
    });
    expect((await exportGET(request(`${base}/copies/${receiptId}/export`), context)).status).toBe(
      409,
    );
  } finally {
    log.mockRestore();
  }
});
