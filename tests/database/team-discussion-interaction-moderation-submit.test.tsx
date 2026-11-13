import { expect, it, vi } from "vitest";
import {
  createModerationRemovalInteractionHelpers,
  mockReactHooks,
  response,
  version,
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
vi.mock("../../site/src/components/confirm-action", () => ({
  confirmAction,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));

import { ModeratedDiscussionRemoval } from "../../site/src/components/moderated-discussion-removal";

const { render, button, click, prepareComment } = createModerationRemovalInteractionHelpers(
  harness,
  ModeratedDiscussionRemoval,
  confirmAction,
);

it("submits trimmed scoped moderation reason, confirms exact removal and blocks repeat writes", async () => {
  prepareComment();
  harness.fetch.mockResolvedValueOnce(
    response({ contentId: "post", commentId: "comment", removed: true }),
  );
  click("Remove comment");
  await vi.waitFor(() => expect(harness.refresh).toHaveBeenCalledOnce());
  expect(harness.fetch.mock.calls[0][0]).toBe("/api/admin/community/post/discussion/comment");
  expect(JSON.parse(harness.fetch.mock.calls[0][1].body)).toEqual({
    reason: "Reviewed reason",
    expectedRevision: version,
  });
  expect(button(render(), "Remove comment").props.disabled).toBe(true);
});
