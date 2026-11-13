import { expect, it, vi } from "vitest";
import {
  createContentReactionRemoveInteractionHelpers,
  mockReactHooks,
  response,
} from "./helpers/content-reaction-remove-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as (() => void)[],
  fetch: vi.fn(),
  actorId: "actor",
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../site/src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ usePathname: () => "/articles/guide" }));
vi.mock("next/link", () => ({ default: "a" }));

import { ContentReactions } from "../site/src/components/content-reactions";
import { reactionCopy } from "../site/src/lib/content-reaction-copy";

const { render, removeButton } = createContentReactionRemoveInteractionHelpers(
  harness,
  ContentReactions,
  confirmAction,
);

it("confirms before clearing a reaction", async () => {
  const copy = reactionCopy("en");
  harness.fetch.mockResolvedValueOnce(
    response({
      contentId: "content",
      actorId: "actor",
      slug: "guide",
      reaction: null,
      counts: { helpful: 2, thanks: 2, insight: 0 },
      changed: true,
    }),
  );
  await (removeButton(render()).props.onClick as () => Promise<void>)();
  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.removeConfirmTitle,
    object: copy.thanks,
    consequences: copy.removeConfirm,
    confirmLabel: copy.remove,
    cancelLabel: copy.cancel,
    closeLabel: copy.cancel,
    danger: false,
  });
  expect(harness.fetch).toHaveBeenCalledOnce();
  expect(harness.fetch.mock.calls[0]?.[1]).toMatchObject({
    method: "PUT",
    body: JSON.stringify({ reaction: null }),
  });
});

it("keeps the reaction when confirmation is cancelled", async () => {
  confirmAction.mockResolvedValueOnce(false);
  await (removeButton(render()).props.onClick as () => Promise<void>)();
  expect(harness.fetch).not.toHaveBeenCalled();
});
