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
vi.mock("../site/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" }),
  LocaleProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../site/src/components/confirm-action", () => ({ confirmAction }));

import { FollowButton } from "../site/src/components/follow-button";

const { render, toggle } = createDiscussionWatchInteractionHelpers(
  harness,
  FollowButton,
  confirmAction,
);

it("blocks repeated clicks while a request is in flight", async () => {
  let resolve!: (value: Response) => void;
  harness.fetch.mockImplementation(
    () =>
      new Promise<Response>((done) => {
        resolve = done;
      }),
  );
  const click = toggle(render()).props.onClick as () => Promise<void>;
  const write = click();
  await click();
  expect(harness.fetch).toHaveBeenCalledOnce();
  expect(toggle(render()).props.disabled).toBe(true);
  resolve(response(ack));
  await write;
});
