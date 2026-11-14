import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import {
  createFollowButtonUnfollowInteractionHelpers,
  mockReactHooks,
  response,
} from "../helpers/follow-button-unfollow-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as (() => void)[],
  fetch: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../../src/components/confirm-action", () => ({
  confirmAction,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("../../src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" }),
  LocaleProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/workspace/saved",
}));

import { FollowButton } from "../../src/components/follow-button";

const { render, toggle } = createFollowButtonUnfollowInteractionHelpers(
  harness,
  FollowButton,
  confirmAction,
);

it("binds the displayed account to the unfollow request after an account switch", async () => {
  harness.fetch.mockResolvedValueOnce(response({ code: "ACTOR_CHANGED" }, 409));
  await (toggle(render()).props.onClick as () => Promise<void>)();
  expect(JSON.parse(harness.fetch.mock.calls[0][1].body)).toMatchObject({
    expectedActorId: "usr_1",
  });
  expect(render().some((node) => node.props["aria-pressed"] === true)).toBe(false);
});
