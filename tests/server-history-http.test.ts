import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ getHistory: vi.fn() }));
vi.mock("../apps/web/src/lib/services/server-history-service", () => ({
  serverHistoryService: { getHistory: state.getHistory },
  serverHistoryWindows: { "24h": 24, "7d": 168, "30d": 720 },
}));
import { GET } from "../apps/web/src/app/api/servers/[id]/history/route";
const params = { params: Promise.resolve({ id: "server" }) };
beforeEach(() => {
  state.getHistory.mockReset();
});
it.each(["24h", "7d", "30d"])(
  "returns a read-only complete %s window with no public cache",
  async (window) => {
    state.getHistory.mockResolvedValue({
      window,
      summary: { observationCount: 8000 },
      samplesTruncated: true,
      absenceMeansOffline: false,
    });
    const response = await GET(
      new NextRequest(`https://nexus.test/api/servers/server/history?window=${window}`),
      params,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      window,
      samplesTruncated: true,
      absenceMeansOffline: false,
    });
    expect(state.getHistory).toHaveBeenCalledExactlyOnceWith("server", window);
  },
);
it.each(["365d", "", "bad"])(
  "rejects invalid API windows %s before database access",
  async (window) => {
    const response = await GET(
      new NextRequest(`https://nexus.test/api/servers/server/history?window=${window}`),
      params,
    );
    expect(response.status).toBe(400);
    expect(state.getHistory).not.toHaveBeenCalled();
  },
);
it("defaults an absent API window to twenty-four hours and hides missing/private servers", async () => {
  state.getHistory.mockResolvedValue(null);
  const response = await GET(
    new NextRequest("https://nexus.test/api/servers/server/history"),
    params,
  );
  expect(response.status).toBe(404);
  expect(state.getHistory).toHaveBeenCalledExactlyOnceWith("server", "24h");
  expect(await response.json()).toEqual({ error: "Server not found" });
});
it("returns a generic retryable failure without exposing database errors", async () => {
  state.getHistory.mockRejectedValue(new Error("private SQL payload"));
  const response = await GET(
    new NextRequest("https://nexus.test/api/servers/server/history"),
    params,
  );
  expect(response.status).toBe(503);
  expect(response.headers.get("retry-after")).toBe("30");
  expect(await response.text()).not.toContain("private SQL payload");
});
