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

const { render, click, reviewed } = createCollectionReleaseWatchesInteractionHelpers(
  h,
  ResourceReleaseWatchBatchControls,
);

it("requires reload when collection membership changed", async () => {
  reviewed();
  h.fetch.mockResolvedValueOnce({
    ok: false,
    status: 409,
    json: async () => ({ code: "RELEASE_WATCH_COLLECTION_CONFLICT" }),
  });
  await click("Enable selected watches");
  expect(
    render().some((n) => n.type === "button" && n.props.children === "Retry the same request"),
  ).toBe(false);
  await click("Reload current state");
  expect(h.refresh).toHaveBeenCalledOnce();
});
