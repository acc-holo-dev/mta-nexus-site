import { expect, it, vi } from "vitest";
import { followCopy } from "../apps/web/src/lib/follow-workspace-copy";
import {
  ack,
  createSavedFollowsInteractionHelpers,
  mockReactHooks,
  response,
} from "./helpers/saved-follows-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as (() => void)[],
  fetch: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../apps/web/src/components/confirm-action", () => ({
  confirmAction,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));

import { FollowWorkspace } from "../apps/web/src/components/follow-workspace";

const { render, removeButton } = createSavedFollowsInteractionHelpers(
  harness,
  FollowWorkspace,
  confirmAction,
);

it("does not delete a saved follow when removal is cancelled", async () => {
  confirmAction.mockResolvedValueOnce(false);
  await (removeButton(render(), "en").props.onClick as () => Promise<void>)();
  expect(confirmAction).toHaveBeenCalledWith(
    expect.objectContaining({
      title: followCopy("en").removeConfirmTitle,
      object: "Team",
      consequences: followCopy("en").removeConfirm,
    }),
  );
  expect(harness.fetch).not.toHaveBeenCalled();
});

it("deletes a saved follow only after confirmAction approves removal", async () => {
  harness.fetch.mockResolvedValueOnce(response(ack));
  await (removeButton(render(), "en").props.onClick as () => Promise<void>)();
  expect(harness.fetch).toHaveBeenCalledTimes(1);
  expect(harness.fetch.mock.calls[0][0]).toBe("/api/follow");
  expect(harness.fetch.mock.calls[0][1]).toMatchObject({
    method: "DELETE",
    body: JSON.stringify({
      targetType: "organization",
      targetId: "org",
      expectedActorId: "usr_1",
    }),
  });
});
