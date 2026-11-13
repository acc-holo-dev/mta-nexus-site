import { expect, it, vi } from "vitest";

vi.mock("@nexus/db", async () => {
  const { createLibraryCollectionsHttpDbMock } = await import(
    "./helpers/library-collections-http-harness"
  );
  return createLibraryCollectionsHttpDbMock();
});
vi.mock("@nexus/security", async () => {
  const { libraryCollectionsHttpState } = await import(
    "./helpers/library-collections-http-harness"
  );
  return {
    consumeRateLimit: libraryCollectionsHttpState.rate,
    generateId: (prefix: string) => `${prefix}_a`,
  };
});
vi.mock("../site/src/lib/services/auth-service", async () => {
  const { libraryCollectionsHttpState } = await import(
    "./helpers/library-collections-http-harness"
  );
  return {
    authService: { getSession: async () => libraryCollectionsHttpState.actor },
  };
});

import { GET as releasesExport } from "../site/src/app/api/library/collections/[id]/releases/export/route";
import { GET as releases } from "../site/src/app/api/library/collections/[id]/releases/route";
import {
  libraryCollectionsHttpBase as base,
  libraryCollectionsHttpContext as context,
  installLibraryCollectionsHttpLifecycle,
  libraryCollectionsHttpRequest as request,
  libraryCollectionsHttpState as state,
} from "./helpers/library-collections-http-harness";

installLibraryCollectionsHttpLifecycle();

it("serves scoped private release inspection and bounded attachment exports", async () => {
  const path = `${base}/lcol_a/releases`;
  const response = await releases(request(`${path}?page=2&filter=updates&q=core`), context);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(state.releases).toHaveBeenCalledWith("usr_a", "lcol_a", 2, "updates", "core");
  const download = await releasesExport(request(`${path}/export`), context);
  expect(download.headers.get("content-disposition")).toContain("attachment");
  expect(download.headers.get("x-content-type-options")).toBe("nosniff");
  state.releases.mockResolvedValue({ text: "x".repeat(512 * 1024) });
  expect((await releasesExport(request(`${path}/export`), context)).status).toBe(413);
});
it("rejects unauthenticated, spoofed and over-rate release inspections before reading data", async () => {
  const path = `${base}/lcol_a/releases`;
  expect((await releases(request(`${path}?userId=other`), context)).status).toBe(400);
  expect(state.releases).not.toHaveBeenCalled();
  state.actor = null;
  expect((await releasesExport(request(`${path}/export`), context)).status).toBe(401);
  state.actor = { id: "usr_a", role: "user" };
  state.rate.mockResolvedValue({ success: false });
  expect((await releases(request(path), context)).status).toBe(429);
  expect(state.releases).not.toHaveBeenCalled();
});
