import { afterEach, expect, it, vi } from "vitest";
import { fetchServerStatisticsCsv } from "../apps/web/src/lib/server-statistics-download";
import { serverStatisticsCopy } from "../apps/web/src/lib/server-statistics-copy";
afterEach(() => vi.unstubAllGlobals());
it("downloads only confirmed CSV and uses the existing private request policy", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      new Response("column\r\n1\r\n", { headers: { "Content-Type": "text/csv; charset=utf-8" } }),
    );
  vi.stubGlobal("fetch", fetcher);
  const result = await fetchServerStatisticsCsv("/api/export", "ru");
  expect(result.ok).toBe(true);
  expect(fetcher.mock.calls[0][1]).toMatchObject({
    cache: "no-store",
    credentials: "same-origin",
    method: "GET",
  });
});
it("retains a localized permission error without starting a download", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json({ code: "UNAUTHORIZED", error: "unsafe details" }, { status: 401 }),
      ),
  );
  expect(await fetchServerStatisticsCsv("/api/export", "ru")).toEqual({
    ok: false,
    error: serverStatisticsCopy("ru").signIn,
  });
});
it.each([
  new Response("<html>login</html>", { headers: { "Content-Type": "text/html" } }),
  new Response("", { headers: { "Content-Type": "text/csv" } }),
  new Response("a".repeat(128 * 1024 + 1), { headers: { "Content-Type": "text/csv" } }),
])("rejects an unconfirmed or oversized file", async (response) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
  expect(await fetchServerStatisticsCsv("/api/export", "en")).toEqual({
    ok: false,
    error: serverStatisticsCopy("en").unavailable,
  });
});
it("localizes network failures without exposing English runtime text", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
  expect(await fetchServerStatisticsCsv("/api/export", "ru")).toEqual({
    ok: false,
    error: serverStatisticsCopy("ru").unavailable,
  });
});
