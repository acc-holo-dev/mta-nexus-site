import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { serverHistoryApiCopy } from "../../src/features/servers/server-history-api-copy";

const mocks = vi.hoisted(() => ({
  getHistory: vi.fn(),
}));

vi.mock("../../src/lib/services/servers/server-history-service", () => ({
  serverHistoryService: { getHistory: mocks.getHistory },
  serverHistoryWindows: { "24h": 24, "7d": 168, "30d": 720 },
}));

import { GET } from "../../src/app/api/servers/[id]/history/route";

const params = { params: Promise.resolve({ id: "server" }) };

function request(locale: "en" | "ru", window?: string) {
  const url = new URL("https://nexus.test/api/servers/server/history");
  if (window !== undefined) url.searchParams.set("window", window);
  return new NextRequest(url, {
    headers: { cookie: `nexus_locale=${locale}` },
  });
}

describe("server history API locale envelope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns bilingual invalid window and not-found from nexus_locale", async () => {
    const invalid = await GET(request("ru", "bad"), params);
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({
      error: serverHistoryApiCopy("ru").invalidWindow,
    });
    expect(mocks.getHistory).not.toHaveBeenCalled();

    mocks.getHistory.mockResolvedValueOnce(null);
    const missing = await GET(request("en"), params);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({
      error: serverHistoryApiCopy("en").serverNotFound,
    });
  });

  it("returns bilingual unavailable from nexus_locale", async () => {
    mocks.getHistory.mockRejectedValueOnce(new Error("private"));
    const ru = await GET(request("ru"), params);
    expect(ru.status).toBe(503);
    expect(await ru.json()).toMatchObject({
      error: serverHistoryApiCopy("ru").unavailable,
    });
  });
});
