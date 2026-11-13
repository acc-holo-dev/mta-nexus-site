import { expect, it, vi } from "vitest";
import {
  contentId,
  createReactionRemovalConfirmInteractionHelpers,
  mockReactHooks,
  response,
} from "../helpers/reaction-removal-confirm-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as Array<undefined | (() => void)>,
  fetch: vi.fn(),
  actorId: "actor",
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../../site/src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", (original) => mockReactHooks(harness)(original));

import { ReactionRemoval } from "../../site/src/components/reaction-removal";
import { reactionCopy } from "../../site/src/lib/content-reaction-copy";

const { render, removeButton } = createReactionRemovalConfirmInteractionHelpers(
  harness,
  ReactionRemoval,
  confirmAction,
);

it("confirms workspace reaction removal before DELETE", async () => {
  const copy = reactionCopy("en");
  harness.fetch.mockResolvedValueOnce(response({ contentId, removed: true, actorId: "actor" }));

  await (removeButton(render()).props.onClick as () => Promise<void>)();
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledTimes(1));

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.removeConfirmTitle,
    object: contentId,
    consequences: copy.removeConfirm,
    confirmLabel: copy.remove,
    cancelLabel: copy.cancel,
    closeLabel: copy.cancel,
    danger: true,
  });
  expect(harness.fetch).toHaveBeenCalledWith(
    `/api/workspace/reactions/${encodeURIComponent(contentId)}`,
    expect.objectContaining({ method: "DELETE" }),
  );
});

it("keeps the workspace reaction when confirmation is cancelled", async () => {
  confirmAction.mockResolvedValueOnce(false);
  await (removeButton(render()).props.onClick as () => Promise<void>)();
  expect(harness.fetch).not.toHaveBeenCalled();
});
