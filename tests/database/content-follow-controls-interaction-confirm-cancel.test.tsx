import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import {
  createContentFollowControlsInteractionHelpers,
  mockReactHooks,
  response,
} from "../helpers/content-follow-controls-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as (() => void)[],
  fetch: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../../site/src/components/confirm-action", () => ({
  confirmAction,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("../../site/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" }),
  LocaleProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/articles/article",
}));

import { ContentFollowControls } from "../../site/src/components/content-follow-controls";
import { followCopy } from "../../site/src/lib/follow-workspace-copy";

const { render, saveToggle } = createContentFollowControlsInteractionHelpers(
  harness,
  ContentFollowControls,
  confirmAction,
);

it.each(["en", "ru"] as const)(
  "asks for confirmation before content unfollow DELETE in %s",
  async (locale) => {
    const copy = followCopy(locale);
    harness.fetch.mockResolvedValueOnce(
      response({
        success: true,
        following: false,
        notifyComments: false,
        targetType: "content",
        targetId: "article",
      }),
    );
    await (saveToggle(render(locale), locale).props.onClick as () => Promise<void>)();
    expect(confirmAction).toHaveBeenCalledWith({
      title: copy.removeConfirmTitle,
      object: "Article",
      consequences: copy.removeConfirm,
      confirmLabel: copy.removeSave,
      cancelLabel: copy.cancel,
      closeLabel: copy.cancel,
    });
    expect(harness.fetch).toHaveBeenCalledOnce();
    expect(harness.fetch.mock.calls[0][1]).toMatchObject({ method: "DELETE" });
  },
);

it("skips content unfollow when confirmation is cancelled", async () => {
  confirmAction.mockResolvedValueOnce(false);
  await (saveToggle(render()).props.onClick as () => Promise<void>)();
  expect(harness.fetch).not.toHaveBeenCalled();
  expect(saveToggle(render()).props["aria-pressed"]).toBe(true);
});
