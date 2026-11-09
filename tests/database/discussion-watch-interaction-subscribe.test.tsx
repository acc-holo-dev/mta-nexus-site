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
vi.mock("../../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" }),
  LocaleProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../../apps/web/src/components/confirm-action", () => ({ confirmAction }));

import { FollowButton } from "../../apps/web/src/components/follow-button";

const { render, toggle } = createDiscussionWatchInteractionHelpers(
  harness,
  FollowButton,
  confirmAction,
);

it.each(["en", "ru"] as const)(
  "saves a confirmed discussion subscription and then its removal in %s",
  async (locale) => {
    harness.fetch
      .mockResolvedValueOnce(response(ack))
      .mockResolvedValueOnce(response({ ...ack, following: false }));
    await (toggle(render(locale)).props.onClick as () => Promise<void>)();
    expect(toggle(render(locale)).props["aria-pressed"]).toBe(true);
    expect(harness.fetch.mock.calls[0][0]).toBe("/api/follow");
    expect(harness.fetch.mock.calls[0][1]).toMatchObject({
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify({
        targetType: "content",
        targetId: "article",
        expectedActorId: "usr_1",
      }),
    });
    await (toggle(render(locale)).props.onClick as () => Promise<void>)();
    expect(harness.fetch.mock.calls[1][1].method).toBe("DELETE");
    expect(toggle(render(locale)).props["aria-pressed"]).toBe(false);
    expect(render(locale).some((node) => node.props.role === "status")).toBe(true);
  },
);
