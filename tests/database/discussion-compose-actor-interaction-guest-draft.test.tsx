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

import { ContentDiscussion } from "../../site/src/components/content-discussion";

const { render, changeText, submit } = createDiscussionComposeActorInteractionHelpers(
  h,
  ContentDiscussion,
);

it("retains a guest draft for explicit publication after sign-in, without a guest request", async () => {
  changeText("Guest draft text", null);
  await submit(null);
  expect(h.fetch).not.toHaveBeenCalled();
  h.slots = [];
  const field = render("usr_a").find((node) => node.type === "textarea");
  expect(field?.props.value).toBe("Guest draft text");
  expect(sessionStorage.getItem("nexus:discussion:compose:v2:guest:content")).toBeNull();
  expect(sessionStorage.getItem("nexus:discussion:compose:v2:user:usr_a:content")).toContain(
    "Guest draft text",
  );
});
