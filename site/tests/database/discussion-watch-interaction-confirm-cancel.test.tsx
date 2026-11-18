import type { ReactNode } from "react";
import { getDictionary } from "../../src/lib/i18n";
import { expect, it, vi } from "vitest";
import {
  createDiscussionWatchInteractionHelpers,
  initial,
  mockReactHooks,
} from "../helpers/discussion-watch-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as (() => void)[],
  fetch: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ usePathname: () => "/articles/article" }));
vi.mock("../../src/features/shell/locale", () => ({
  useNexusLocale: () => ({ locale: "en", dictionary: getDictionary("en") }),
  LocaleProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../../src/features/shell/confirm-action", () => ({ confirmAction }));

import { FollowButton } from "../../src/features/community/follow";
import { followActionCopy, followCopy } from "../../src/features/community/follow-workspace-copy";

const { render, toggle } = createDiscussionWatchInteractionHelpers(
  harness,
  FollowButton,
  confirmAction,
);

it("does not stop watching when confirmation is cancelled", async () => {
  const shared = followCopy("en");
  const copy = followActionCopy("en", "content");
  initial.following = true;
  confirmAction.mockResolvedValueOnce(false);

  await (toggle(render()).props.onClick as () => Promise<void>)();

  expect(confirmAction).toHaveBeenCalledWith({
    title: shared.removeConfirmTitle,
    object: "Article",
    consequences: shared.removeConfirm,
    confirmLabel: copy.unfollow,
    cancelLabel: shared.cancel,
    closeLabel: shared.cancel,
  });
  expect(harness.fetch).not.toHaveBeenCalled();
  expect(toggle(render()).props["aria-pressed"]).toBe(true);
});
