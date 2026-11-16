import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import {
  ack,
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
vi.mock("../../src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" }),
  LocaleProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../../src/components/confirm-action", () => ({ confirmAction }));

import { FollowButton } from "../../src/components/follow-button";

const { render, toggle } = createDiscussionWatchInteractionHelpers(
  harness,
  FollowButton,
  confirmAction,
);

it.each([
  [200, { ...ack, targetId: "foreign" }],
  [200, { ...ack, following: false }],
  [200, { success: true }],
  [503, { code: "INTERNAL_ERROR" }],
] as const)(
  "requires exact confirmed identity/state after status %s and prevents stale handler retries",
  async (status, body) => {
    harness.fetch.mockResolvedValue(response(body, status));
    const oldClick = toggle(render()).props.onClick as () => Promise<void>;
    await oldClick();
    await oldClick();
    expect(harness.fetch).toHaveBeenCalledOnce();
    expect(render().some((node) => node.props.role === "alert")).toBe(true);
    expect(render().some((node) => node.props["aria-pressed"] === true)).toBe(false);
  },
);
