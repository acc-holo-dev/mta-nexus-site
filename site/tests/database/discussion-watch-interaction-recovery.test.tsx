import type { ReactElement, ReactNode } from "react";
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
vi.mock("../../src/features/shell/locale", () => ({
  useNexusLocale: () => ({ locale: "en" }),
  LocaleProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../../src/features/shell/confirm-action", () => ({ confirmAction }));

import { FollowButton } from "../../src/features/community/follow";
import { followCopy } from "../../src/features/community/follow-workspace-copy";
import { flattenReactTestTree } from "../helpers/flatten-react-test-tree";

const { render, toggle } = createDiscussionWatchInteractionHelpers(
  harness,
  FollowButton,
  confirmAction,
);
it("rechecks a session error before enabling follow actions", async () => {
  const initial = { authenticated: false, actorId: null, following: false, error: true };
  function renderUnavailable() {
    harness.cursor = 0;
    const wrapper = FollowButton({
      targetType: "content",
      targetId: "article",
      targetName: "Article",
      initial,
      locale: "en",
    });
    const control = wrapper.props.children as ReactElement;
    return flattenReactTestTree((control.type as (props: unknown) => ReactNode)(control.props));
  }
  const nodes = renderUnavailable();
  const retry = nodes.find(
    (node) => node.type === "button" && node.props.children === followCopy("en").retry,
  );
  if (!retry) throw Error("Missing retry");
  expect(harness.fetch).not.toHaveBeenCalled();
  harness.fetch.mockResolvedValueOnce(
    response({
      authenticated: true,
      actorId: "usr_1",
      following: false,
      targetType: "content",
      targetId: "article",
    }),
  );
  (retry.props.onClick as () => void)();
  renderUnavailable();
  await vi.waitFor(() => expect(toggle(renderUnavailable()).props["aria-pressed"]).toBe(false));
  expect(harness.fetch).toHaveBeenCalledOnce();
});

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
