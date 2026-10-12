import { AppError } from "@nexus/domain";
import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  actor: { id: "actor", role: "user" } as { id: string; role: string } | null,
  preview: vi.fn(),
  save: vi.fn(),
  history: vi.fn(),
  rate: vi.fn(),
  browseRate: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.actor },
}));
vi.mock("../apps/web/src/lib/services/server-service", () => ({
  serverService: { previewVisibility: state.preview, saveVisibility: state.save },
}));
vi.mock("../apps/web/src/lib/services/server-workspace-history-service", () => ({
  serverWorkspaceHistoryService: { page: state.history },
}));
vi.mock("../apps/web/src/lib/server-content-api", () => ({ serverContentRate: state.browseRate }));
vi.mock("@nexus/security", () => ({ consumeRateLimit: state.rate }));

import { GET as exportPage } from "../apps/web/src/app/api/workspace/servers/[id]/activity/export/route";
import { GET as history } from "../apps/web/src/app/api/workspace/servers/[id]/activity/route";
import { POST as preview } from "../apps/web/src/app/api/workspace/servers/visibility/preview/route";
import { POST as save } from "../apps/web/src/app/api/workspace/servers/visibility/route";

const time = "2026-10-12T00:00:00.123456Z",
  scope = { params: Promise.resolve({ id: "server" }) },
  payload = { serverIds: ["a"], visibility: "private" };
const request = (
  method = "POST",
  body: unknown = payload,
  query = "",
  headers: Record<string, string> = {},
) =>
  new NextRequest(`https://nexus.test/api/workspace/servers/visibility${query}`, {
    method,
    headers: {
      cookie: "nexus_session=token; nexus_locale=ru",
      "content-type": "application/json",
      ...headers,
    },
    ...(method !== "GET" ? { body: JSON.stringify(body) } : {}),
  });
beforeEach(() => {
  vi.clearAllMocks();
  state.actor = { id: "actor", role: "user" };
  state.rate.mockResolvedValue({ success: true });
  state.browseRate.mockResolvedValue(undefined);
  state.preview.mockResolvedValue({ visibility: "private", items: [] });
  state.save.mockResolvedValue({ visibility: "private", items: [] });
  state.history.mockResolvedValue({
    server: { id: "server", name: "Server" },
    until: time,
    period: "all",
    action: "all",
    events: [],
    nextCursor: null,
  });
});
it.each([preview, save])(
  "authenticates, bounds and rates a private JSON visibility operation",
  async (handler) => {
    const response = await handler(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(state.rate).toHaveBeenCalledExactlyOnceWith("serverMutation", "actor");
    expect(handler === preview ? state.preview : state.save).toHaveBeenCalledExactlyOnceWith(
      state.actor,
      payload,
    );
  },
);
it.each([preview, save])(
  "rejects unauthenticated and cross-site writes before mutation",
  async (handler) => {
    state.actor = null;
    expect((await handler(request())).status).toBe(401);
    expect(state.rate).not.toHaveBeenCalled();
    state.actor = { id: "actor", role: "user" };
    expect(
      (await handler(request("POST", payload, "", { "sec-fetch-site": "cross-site" }))).status,
    ).toBe(403);
    expect(state.preview).not.toHaveBeenCalled();
    expect(state.save).not.toHaveBeenCalled();
  },
);
it.each([preview, save])(
  "rejects queries, incorrect media, oversize bodies and throttling without touching the service",
  async (handler) => {
    expect((await handler(request("POST", payload, "?limit=999"))).status).toBe(400);
    expect(
      (await handler(request("POST", payload, "", { "content-type": "text/plain" }))).status,
    ).toBe(415);
    expect((await handler(request("POST", { data: "x".repeat(8193) }))).status).toBe(413);
    state.rate.mockResolvedValue({ success: false });
    expect((await handler(request())).status).toBe(429);
    expect(state.preview).not.toHaveBeenCalled();
    expect(state.save).not.toHaveBeenCalled();
  },
);
it("returns localized stale-review errors and never reports an uncertain save as successful", async () => {
  state.save.mockRejectedValue(
    new AppError("Private internal reason", 409, "SERVER_BATCH_CHANGED"),
  );
  const response = await save(request());
  expect(response.status).toBe(409);
  const json = await response.json();
  expect(json.code).toBe("SERVER_BATCH_CHANGED");
  expect(json.error).toContain("изменились");
  expect(JSON.stringify(json)).not.toContain("Private internal");
});
it.each([history, exportPage])(
  "uses a private bounded, current-authority history with validated filters",
  async (handler) => {
    const response = await handler(
      request("GET", undefined, `?period=30&action=visibility&until=${encodeURIComponent(time)}`),
      scope,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(state.history).toHaveBeenCalledExactlyOnceWith("actor", "server", {
      period: "30",
      action: "visibility",
      cursor: undefined,
      legacyCursor: undefined,
      until: time,
    });
    expect(state.browseRate).toHaveBeenCalledExactlyOnceWith("actor", "search");
  },
);
it("exports one JSON page only after successful current-scope authorization", async () => {
  const response = await exportPage(request("GET"), scope);
  expect(response.headers.get("content-disposition")).toBe(
    'attachment; filename="server-activity.json"',
  );
  expect((await response.json()).events).toEqual([]);
  state.history.mockRejectedValue(new AppError("Unavailable scope", 404, "NOT_FOUND"));
  const denied = await exportPage(request("GET"), scope);
  expect(denied.status).toBe(404);
  expect(denied.headers.get("content-disposition")).toBeNull();
});
it.each([history, exportPage])(
  "does not query private history with invalid filters or missing authentication",
  async (handler) => {
    expect((await handler(request("GET", undefined, "?period=7&period=30"), scope)).status).toBe(
      400,
    );
    expect(state.history).not.toHaveBeenCalled();
    state.actor = null;
    expect((await handler(request("GET"), scope)).status).toBe(401);
    expect(state.history).not.toHaveBeenCalled();
  },
);
