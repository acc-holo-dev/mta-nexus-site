import { AppError } from "@nexus/domain";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "./browser-mutation-headers";
const state = vi.hoisted(() => ({
  actor: { id: "usr_a" } as { id: string } | null,
  preview: vi.fn(),
  command: vi.fn(),
  history: vi.fn(),
  rate: vi.fn(),
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: state.rate }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.actor },
}));
vi.mock("../apps/web/src/lib/services/library-selection-batches-service", () => ({
  librarySelectionBatchesService: {
    preview: state.preview,
    command: state.command,
    history: state.history,
  },
}));
import { POST as apply } from "../apps/web/src/app/api/library/collections/[id]/versions/route";
import { POST as review } from "../apps/web/src/app/api/library/collections/[id]/versions/preview/route";
import { GET as history } from "../apps/web/src/app/api/library/collections/[id]/versions/history/route";
import { GET as download } from "../apps/web/src/app/api/library/collections/[id]/versions/history/export/route";
const context = { params: Promise.resolve({ id: "lcol_a" }) },
  body = { mode: "fixed", productIds: ["prd_a"] };
function request(section = "", method = "POST", headers: Record<string, string> = {}, query = "") {
  return new NextRequest(
    `http://nexus.test/api/library/collections/lcol_a/versions${section}${query}`,
    {
      method,
      headers: { ...browserMutationHeaders(), "content-type": "application/json", ...headers },
      ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
    },
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  stubBrowserMutationOrigin();
  state.actor = { id: "usr_a" };
  state.rate.mockResolvedValue({ success: true });
  state.preview.mockResolvedValue({ previewDigest: "a".repeat(64) });
  state.command.mockResolvedValue({ replayed: false });
  state.history.mockResolvedValue({ items: [] });
});
afterEach(() => {
  vi.unstubAllEnvs();
});
it.each([apply, review, history, download])(
  "requires authentication for every batch surface",
  async (handler) => {
    state.actor = null;
    expect((await handler(request(), context)).status).toBe(401);
    expect(state.preview).not.toHaveBeenCalled();
    expect(state.command).not.toHaveBeenCalled();
    expect(state.history).not.toHaveBeenCalled();
  },
);
it("binds actor and collection, applies the appropriate rate policy and disables caching", async () => {
  const response = await review(request("/preview"), context);
  expect(state.preview).toHaveBeenCalledWith({ id: "usr_a" }, "lcol_a", body);
  expect(state.rate).toHaveBeenCalledWith("contentCreation", "usr_a");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  await apply(request(), context);
  expect(state.command).toHaveBeenCalledWith({ id: "usr_a" }, "lcol_a", body);
});
it.each([apply, review])(
  "rejects cross-site JSON writes before touching the batch",
  async (handler) => {
    expect(
      (await handler(request("", "POST", { "sec-fetch-site": "cross-site" }), context)).status,
    ).toBe(403);
    expect(state.command).not.toHaveBeenCalled();
    expect(state.preview).not.toHaveBeenCalled();
  },
);
it.each([apply, review])("rejects unexpected mutation queries", async (handler) => {
  expect((await handler(request("", "POST", {}, "?scope=other"), context)).status).toBe(400);
  expect(state.command).not.toHaveBeenCalled();
  expect(state.preview).not.toHaveBeenCalled();
});
it("does not run batch operations when the write limit is exceeded", async () => {
  state.rate.mockResolvedValue({ success: false });
  expect((await apply(request(), context)).status).toBe(429);
  expect(state.command).not.toHaveBeenCalled();
});
it("returns stable conflicts without exposing private exception messages", async () => {
  state.command.mockRejectedValue(new AppError("private title", 409, "SELECTION_BATCH_CHANGED"));
  const response = await apply(request(), context);
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ code: "SELECTION_BATCH_CHANGED" });
});
it("validates history pagination and protects downloads", async () => {
  const response = await download(request("/history/export", "GET", {}, "?page=2"), context);
  expect(state.history).toHaveBeenCalledWith({ id: "usr_a" }, "lcol_a", 2);
  expect(state.rate).toHaveBeenCalledWith("resourceInspection", "usr_a");
  expect(response.headers.get("content-disposition")).toBe(
    "attachment; filename=version-selection-history.json",
  );
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect((await history(request("/history", "GET", {}, "?page=1&page=2"), context)).status).toBe(
    400,
  );
});
it("bounds history exports", async () => {
  state.history.mockResolvedValue({ data: "x".repeat(524289) });
  expect((await download(request("/history/export", "GET"), context)).status).toBe(413);
});
