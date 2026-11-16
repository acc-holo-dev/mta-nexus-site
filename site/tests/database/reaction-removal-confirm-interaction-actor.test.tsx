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
vi.mock("../../src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", (original) => mockReactHooks(harness)(original));

import { ReactionRemoval } from "../../src/components/reaction-removal";
import { reactionCopy } from "../../src/lib/content-reaction-copy";

const { render, removeButton } = createReactionRemovalConfirmInteractionHelpers(
  harness,
  ReactionRemoval,
  confirmAction,
);

it("does not apply a delayed removal response to another account", async () => {
  let complete!: (value: Response) => void;
  harness.fetch.mockReturnValueOnce(
    new Promise<Response>((resolve) => {
      complete = resolve;
    }),
  );
  const pending = (removeButton(render()).props.onClick as () => Promise<void>)();
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledOnce());
  expect(
    (harness.fetch.mock.calls[0][1].headers as Record<string, string>)["x-nexus-actor-id"],
  ).toBe("actor");
  harness.actorId = "other";
  render();
  complete(response({ contentId, removed: true, actorId: "actor" }));
  await pending;
  expect(render().some((node) => node.props.children === reactionCopy("en").removed)).toBe(false);
});
