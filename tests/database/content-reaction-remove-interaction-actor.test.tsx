import { expect, it, vi } from "vitest";
import {
  createContentReactionRemoveInteractionHelpers,
  mockReactHooks,
  response,
} from "../helpers/content-reaction-remove-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as (() => void)[],
  fetch: vi.fn(),
  actorId: "actor",
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../../site/src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ usePathname: () => "/articles/guide" }));
vi.mock("next/link", () => ({ default: "a" }));

import { ContentReactions } from "../../site/src/components/content-reactions";

const { render, removeButton } = createContentReactionRemoveInteractionHelpers(
  harness,
  ContentReactions,
  confirmAction,
);

it("does not apply a delayed public mutation after account changes", async () => {
  let complete!: (response: Response) => void;
  harness.fetch.mockReturnValueOnce(
    new Promise<Response>((resolve) => {
      complete = resolve;
    }),
  );
  const pending = (removeButton(render()).props.onClick as () => Promise<void>)();
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledOnce());
  expect(harness.fetch.mock.calls[0][1].headers["x-nexus-actor-id"]).toBe("actor");
  harness.actorId = "other";
  render();
  complete(
    response(
      {
        contentId: "content",
        actorId: "actor",
        slug: "guide",
        reaction: null,
        counts: { helpful: 2, thanks: 2, insight: 0 },
        changed: true,
      },
      200,
    ),
  );
  await pending;
  expect(removeButton(render())).toBeDefined();
});
