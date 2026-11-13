import { expect, it, vi } from "vitest";
import {
  createResourceReleaseWatchResumeInteractionHelpers,
  mockReactHooks,
} from "./helpers/resource-release-watch-resume-interaction-harness";

const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
  reload: vi.fn(),
  locale: "en",
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("react", async (original) => mockReactHooks(h)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: h.refresh }) }));
vi.mock("../site/src/components/confirm-action", () => ({ confirmAction }));

import { ResourceReleaseWatchBatchControls } from "../site/src/components/resource-release-watch-batch-controls";

const helpers = createResourceReleaseWatchResumeInteractionHelpers(
  h,
  ResourceReleaseWatchBatchControls,
  confirmAction,
);

it("requires reload when reviewed watches conflict instead of applying another selection", async () => {
  helpers.reviewed();
  h.fetch.mockResolvedValueOnce({
    ok: false,
    status: 409,
    json: async () => ({ code: "RELEASE_WATCH_BATCH_CONFLICT" }),
  });
  await helpers.click("Resume selected watches");
  expect(
    helpers
      .render()
      .some((n) => n.type === "button" && n.props.children === "Retry the same request"),
  ).toBe(false);
  await helpers.click("Reload current state");
  expect(h.refresh).toHaveBeenCalledOnce();
});
