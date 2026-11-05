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
vi.mock("../apps/web/src/components/confirm-action", () => ({ confirmAction }));

import { ResourceReleaseWatchBatchControls } from "../apps/web/src/components/resource-release-watch-batch-controls";

const helpers = createResourceReleaseWatchResumeInteractionHelpers(
  h,
  ResourceReleaseWatchBatchControls,
  confirmAction,
);

it("uses account-wide capacity and excludes inaccessible resources", () => {
  helpers.setActiveWatchCount(100);
  expect(helpers.checks()[0].props.disabled).toBe(true);
  expect(helpers.checks()[1].props.disabled).toBe(true);
  expect(
    helpers
      .render()
      .some((n) => n.props.children === "The limit of 100 active watches has been reached."),
  ).toBe(true);
  expect(helpers.checks()).toHaveLength(2);
});
