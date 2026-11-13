import { expect, it, vi } from "vitest";
import {
  createDiscussionCommentActionsConfirmInteractionHelpers,
  mockReactHooks,
} from "../helpers/discussion-comment-actions-confirm-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  request: vi.fn(),
  onPending: vi.fn(),
  onSaved: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../../site/src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("../../site/src/lib/user-platform-client", async (original) => {
  const actual = await original<typeof import("../../site/src/lib/user-platform-client")>();
  return {
    ...actual,
    platformRequest: harness.request,
  };
});

import { DiscussionCommentActions } from "../../site/src/components/discussion-comment-actions";
import { getDiscussionCopy } from "../../site/src/lib/content-discussion-copy";

const { render, control, submit, seedModeratorRemove } =
  createDiscussionCommentActionsConfirmInteractionHelpers(
    harness,
    DiscussionCommentActions,
    confirmAction,
  );

it("keeps the own comment when confirmation is cancelled", async () => {
  const copy = getDiscussionCopy("en");
  confirmAction.mockResolvedValueOnce(false);
  await (control(render(true), copy.remove).props.onClick as () => Promise<void>)();
  expect(harness.request).not.toHaveBeenCalled();
  expect(harness.onSaved).not.toHaveBeenCalled();
});

it("skips moderator removal when confirmation is cancelled", async () => {
  seedModeratorRemove();
  confirmAction.mockResolvedValueOnce(false);
  await submit(render(false));
  expect(harness.request).not.toHaveBeenCalled();
  expect(harness.onSaved).not.toHaveBeenCalled();
});
