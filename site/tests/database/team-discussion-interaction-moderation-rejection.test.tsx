import { expect, it, vi } from "vitest";
import {
  createModerationRemovalInteractionHelpers,
  mockReactHooks,
  response,
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

const { render, button, click, prepareComment } = createModerationRemovalInteractionHelpers(
  harness,
  ModeratedDiscussionRemoval,
  confirmAction,
);

it.each([
  response({ contentId: "post", commentId: "foreign", removed: true }),
  response({ code: "COMMENT_CHANGED" }, 409),
])("blocks unconfirmed moderation result with a reload link", async (result) => {
  prepareComment();
  harness.fetch.mockResolvedValueOnce(result);
  click("Remove comment");
  await vi.waitFor(() => expect(render().some((node) => node.props.role === "alert")).toBe(true));
  expect(harness.refresh).not.toHaveBeenCalled();
  expect(button(render(), "Remove comment").props.disabled).toBe(true);
  expect(
    render().some(
      (node) => node.type === "a" && node.props.href === "/admin/community/post/discussion/comment",
    ),
  ).toBe(true);
});
