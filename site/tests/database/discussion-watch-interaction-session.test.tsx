import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import { getDictionary } from "../../src/lib/i18n";
import {
  createDiscussionWatchInteractionHelpers,
  mockReactHooks,
  response,
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

const { render, toggle, runCleanups } = createDiscussionWatchInteractionHelpers(
  harness,
  FollowButton,
  confirmAction,
);

it("switches to sign in after session revocation and aborts the write on unmount", async () => {
  harness.fetch.mockResolvedValue(response({ code: "UNAUTHORIZED" }, 401));
  const click = toggle(render()).props.onClick as () => Promise<void>;
  await click();
  await click();
  expect(harness.fetch).toHaveBeenCalledOnce();
  expect(
    render().some(
      (node) =>
        typeof node.props.href === "string" &&
        (node.props.href === "/auth/login" ||
          (node.props.href as string).startsWith("/auth/login?next=")),
    ),
  ).toBe(true);
  runCleanups();
  expect(harness.fetch.mock.calls[0][1].signal.aborted).toBe(true);
});
