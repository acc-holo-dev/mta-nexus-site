import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
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
vi.mock("../../site/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" }),
  LocaleProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../../site/src/components/confirm-action", () => ({ confirmAction }));

import { FollowButton } from "../../site/src/components/follow-button";

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
