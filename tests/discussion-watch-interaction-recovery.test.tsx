import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import {
  ack,
  createDiscussionWatchInteractionHelpers,
  mockReactHooks,
  response,
} from "./helpers/discussion-watch-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as (() => void)[],
  fetch: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ usePathname: () => "/articles/article" }));
vi.mock("../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" }),
  LocaleProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../apps/web/src/components/confirm-action", () => ({ confirmAction }));

import { FollowButton } from "../apps/web/src/components/follow-button";
import { followCopy } from "../apps/web/src/lib/follow-workspace-copy";

const { render, toggle } = createDiscussionWatchInteractionHelpers(
  harness,
  FollowButton,
  confirmAction,
);

it("rechecks authoritative state after an uncertain write before allowing another action", async () => {
  harness.fetch.mockRejectedValueOnce(Error("network-private")).mockResolvedValueOnce(
    response({
      authenticated: true,
      actorId: "usr_1",
      following: true,
      targetType: "content",
      targetId: "article",
    }),
  );
  const click = toggle(render()).props.onClick as () => Promise<void>;
  await click();
  await click();
  expect(harness.fetch).toHaveBeenCalledOnce();
  const retry = render().find(
    (node) => node.type === "button" && node.props.children === followCopy("en").retry,
  );
  if (!retry) throw Error("Missing retry");
  (retry.props.onClick as () => void)();
  render();
  await new Promise((resolve) => setImmediate(resolve));
  expect(toggle(render()).props["aria-pressed"]).toBe(true);
  expect(harness.fetch.mock.calls[1][0]).toBe("/api/follow?targetType=content&targetId=article");
  harness.fetch.mockResolvedValueOnce(response({ ...ack, following: false }));
  await (toggle(render()).props.onClick as () => Promise<void>)();
  expect(harness.fetch.mock.calls[2][1].method).toBe("DELETE");
});
