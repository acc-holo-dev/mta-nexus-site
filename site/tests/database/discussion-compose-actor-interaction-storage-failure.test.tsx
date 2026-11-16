import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import {
  createDiscussionComposeActorInteractionHelpers,
  mockReactHooks,
} from "../helpers/discussion-compose-actor-interaction-harness";

const h = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, fetch: vi.fn() }));
vi.mock("react", (original) => mockReactHooks(h)(original));
vi.mock("next/navigation", () => ({ usePathname: () => "/articles/article" }));
vi.mock("next/link", () => ({ default: ({ children }: { children: ReactNode }) => children }));

import { ContentDiscussion } from "../../src/features/community/components/content-discussion";

const { changeText, submit } = createDiscussionComposeActorInteractionHelpers(h, ContentDiscussion);

it("does not send a comment if pending recovery data cannot be stored", async () => {
  changeText("Original private comment");
  vi.stubGlobal("sessionStorage", {
    getItem: () => null,
    setItem: () => {
      throw Error("denied");
    },
    removeItem: () => {},
  });
  await submit();
  expect(h.fetch).not.toHaveBeenCalled();
});
