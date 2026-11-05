import { expect, it, vi } from "vitest";
import {
  createReactionRemovalConfirmInteractionHelpers,
  findNamed,
  mockReactHooks,
  response,
} from "./helpers/reaction-removal-confirm-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as Array<undefined | (() => void)>,
  fetch: vi.fn(),
  actorId: "actor",
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../apps/web/src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", (original) => mockReactHooks(harness)(original));

import { ReactionRemoval } from "../apps/web/src/components/reaction-removal";
import { reactionCopy } from "../apps/web/src/lib/content-reaction-copy";

const { render, removeButton } = createReactionRemovalConfirmInteractionHelpers(
  harness,
  ReactionRemoval,
  confirmAction,
);

it("routes blocked removal failures through ErrorState", async () => {
  const copy = reactionCopy("en");
  harness.fetch.mockResolvedValueOnce(response({ code: "FORBIDDEN" }, 403));

  await (removeButton(render()).props.onClick as () => Promise<void>)();
  await vi.waitFor(() => expect(findNamed(render(), "ErrorState")).toBeDefined());

  expect(findNamed(render(), "ErrorState").props.title).toBeTruthy();
  expect(render().some((node) => node.props.role === "alert" && node.type === "p")).toBe(false);
  expect(render().some((node) => node.props.children === copy.removed)).toBe(false);
});
