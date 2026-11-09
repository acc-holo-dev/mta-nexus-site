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
vi.mock("../../apps/web/src/components/confirm-action", () => ({
  confirmAction,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("../../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" }),
  LocaleProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/workspace/saved",
}));

import { FollowButton } from "../../apps/web/src/components/follow-button";
import { followActionCopy, followCopy } from "../../apps/web/src/lib/follow-workspace-copy";

const { render, toggle } = createFollowButtonUnfollowInteractionHelpers(
  harness,
  FollowButton,
  confirmAction,
);

it.each(["en", "ru"] as const)(
  "asks for confirmation before unfollow DELETE in %s",
  async (locale) => {
    const shared = followCopy(locale),
      action = followActionCopy(locale, "user");
    harness.fetch.mockResolvedValueOnce(
      response({
        success: true,
        following: false,
        targetType: "user",
        targetId: "member",
      }),
    );
    await (toggle(render(locale)).props.onClick as () => Promise<void>)();
    expect(confirmAction).toHaveBeenCalledWith({
      title: shared.removeConfirmTitle,
      object: "Member",
      consequences: shared.removeConfirm,
      confirmLabel: action.unfollow,
      cancelLabel: shared.cancel,
      closeLabel: shared.cancel,
    });
    expect(harness.fetch).toHaveBeenCalledOnce();
    expect(harness.fetch.mock.calls[0][1]).toMatchObject({ method: "DELETE" });
  },
);

it("skips unfollow when confirmation is cancelled", async () => {
  confirmAction.mockResolvedValueOnce(false);
  await (toggle(render()).props.onClick as () => Promise<void>)();
  expect(harness.fetch).not.toHaveBeenCalled();
  expect(toggle(render()).props["aria-pressed"]).toBe(true);
});
