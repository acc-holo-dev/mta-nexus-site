import { expect, it, vi } from "vitest";
import {
  createModerationRemovalInteractionHelpers,
  mockReactHooks,
} from "../helpers/team-discussion-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as (() => void)[],
  refresh: vi.fn(),
  fetch: vi.fn(),
  confirm: vi.fn(),
  acquire: vi.fn(),
  release: vi.fn(),
  failure: vi.fn(),
  committed: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../../src/components/confirm-action", () => ({
  confirmAction,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));

import { ModeratedDiscussionRemoval } from "../../src/features/community/components/moderated-discussion-removal";

const { click, prepareComment } = createModerationRemovalInteractionHelpers(
  harness,
  ModeratedDiscussionRemoval,
  confirmAction,
);

it("cancels removal before requests when explicit confirmation is declined", () => {
  prepareComment();
  confirmAction.mockResolvedValueOnce(false);
  click("Remove comment");
  expect(harness.fetch).not.toHaveBeenCalled();
});
