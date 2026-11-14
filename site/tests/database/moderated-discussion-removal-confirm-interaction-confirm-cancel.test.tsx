import { expect, it, vi } from "vitest";
import {
  commentId,
  contentId,
  createModeratedDiscussionRemovalConfirmInteractionHelpers,
  mockReactHooks,
  reason,
  response,
} from "../helpers/moderated-discussion-removal-confirm-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as Array<undefined | (() => void)>,
  fetch: vi.fn(),
  refresh: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../../src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));

import { ModeratedDiscussionRemoval } from "../../src/features/community/components/moderated-discussion-removal";
import { moderatedDiscussionCopy } from "../../src/lib/moderated-discussion-copy";

const { render, removeButton, prepareReason } =
  createModeratedDiscussionRemovalConfirmInteractionHelpers(
    harness,
    ModeratedDiscussionRemoval,
    confirmAction,
  );

it("confirms before removing a moderated discussion comment", async () => {
  const copy = moderatedDiscussionCopy("en");
  prepareReason();
  harness.fetch.mockResolvedValueOnce(response({ contentId, commentId, removed: true }));

  await (removeButton(render()).props.onClick as () => Promise<void>)();
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledTimes(1));

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.remove,
    object: commentId,
    scope: contentId,
    consequences: copy.confirm,
    confirmLabel: copy.remove,
    cancelLabel: copy.back,
    closeLabel: copy.back,
  });
});

it("keeps reason and pending when confirmation is cancelled", async () => {
  prepareReason();
  const slotsBefore = structuredClone(harness.slots);
  confirmAction.mockResolvedValueOnce(false);

  await (removeButton(render()).props.onClick as () => Promise<void>)();

  expect(confirmAction).toHaveBeenCalledOnce();
  expect(harness.fetch).not.toHaveBeenCalled();
  expect(harness.slots[0]).toBe(reason);
  expect(harness.slots[1]).toBe(false);
  expect(harness.slots).toEqual(slotsBefore);
});
