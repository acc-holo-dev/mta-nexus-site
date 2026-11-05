import { expect, it, vi } from "vitest";
import {
  createCollectionReleaseWatchesInteractionHelpers,
  mockReactHooks,
} from "./helpers/collection-release-watches-interaction-harness";

const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
  reload: vi.fn(),
  locale: "en",
}));
vi.mock("react", async (original) => mockReactHooks(h)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: h.refresh }) }));

import { ResourceReleaseWatchBatchControls } from "../apps/web/src/components/resource-release-watch-batch-controls";

const { click, ack, reviewed, setCollectionId } = createCollectionReleaseWatchesInteractionHelpers(
  h,
  ResourceReleaseWatchBatchControls,
);

it("retains the reviewed collection endpoint when props change before a retry", async () => {
  reviewed();
  h.fetch.mockRejectedValueOnce(new Error("lost"));
  await click("Enable selected watches");
  const [url, init] = h.fetch.mock.calls[0] as [string, RequestInit];
  setCollectionId("lcol_other");
  h.fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ack(init) });
  await click("Retry the same request");
  expect(h.fetch.mock.calls[1][0]).toBe(url);
  expect(h.fetch.mock.calls[1][1].body).toBe(init.body);
  expect(h.refresh).toHaveBeenCalledOnce();
});
