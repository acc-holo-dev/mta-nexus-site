import { expect, it, vi } from "vitest";
import {
  comment,
  contentId,
  createDiscussionCommentActionsConfirmInteractionHelpers,
  mockReactHooks,
  revision,
  slug,
} from "./helpers/discussion-comment-actions-confirm-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  request: vi.fn(),
  onPending: vi.fn(),
  onSaved: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../apps/web/src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("../apps/web/src/lib/user-platform-client", async (original) => {
  const actual = await original<typeof import("../apps/web/src/lib/user-platform-client")>();
  return {
    ...actual,
    platformRequest: harness.request,
  };
});

import { DiscussionCommentActions } from "../apps/web/src/components/discussion-comment-actions";
import { getDiscussionCopy } from "../apps/web/src/lib/content-discussion-copy";

const { render, control, submit, seedModeratorRemove } =
  createDiscussionCommentActionsConfirmInteractionHelpers(
    harness,
    DiscussionCommentActions,
    confirmAction,
  );

it("confirms own comment removal before DELETE", async () => {
  const copy = getDiscussionCopy("en");
  harness.request.mockResolvedValueOnce({
    contentId,
    commentId: comment.id,
    removed: true,
  });

  await (control(render(true), copy.remove).props.onClick as () => Promise<void>)();
  await vi.waitFor(() => expect(harness.request).toHaveBeenCalled());

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.removeConfirmTitle,
    object: comment.text,
    consequences: copy.removeNote,
    confirmLabel: copy.confirmRemove,
    cancelLabel: copy.cancelEdit,
    closeLabel: copy.cancelEdit,
    danger: true,
  });
  expect(harness.request).toHaveBeenCalledWith(
    `/api/content/${encodeURIComponent(slug)}/comments/${encodeURIComponent(comment.id)}`,
    "en",
    "DELETE",
    { expectedRevision: revision },
    expect.any(AbortSignal),
    expect.any(Function),
  );
  expect(harness.onSaved).toHaveBeenCalled();
});

it("confirms moderator comment removal before DELETE", async () => {
  const copy = getDiscussionCopy("en");
  seedModeratorRemove();
  harness.request.mockResolvedValueOnce({
    contentId,
    commentId: comment.id,
    removed: true,
  });

  await submit(render(false));
  await vi.waitFor(() => expect(harness.request).toHaveBeenCalled());

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.moderateRemoveConfirmTitle,
    object: comment.text,
    consequences: copy.moderateRemoveNote,
    confirmLabel: copy.confirmModerateRemove,
    cancelLabel: copy.cancelEdit,
    closeLabel: copy.cancelEdit,
    danger: true,
  });
  expect(harness.request).toHaveBeenCalledWith(
    `/api/content/${encodeURIComponent(slug)}/comments/${encodeURIComponent(comment.id)}`,
    "en",
    "DELETE",
    { expectedRevision: revision, reason: "Spam and off-topic" },
    expect.any(AbortSignal),
    expect.any(Function),
  );
  expect(harness.onSaved).toHaveBeenCalled();
});
