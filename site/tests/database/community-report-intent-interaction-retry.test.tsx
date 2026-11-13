import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import {
  createCommunityReportIntentInteractionHelpers,
  mockReactHooks,
  response,
} from "../helpers/community-report-intent-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effects: [] as (() => unknown)[],
  fetch: vi.fn(),
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ usePathname: () => "/articles/topic" }));
vi.mock("next/link", () => ({ default: ({ children }: { children: ReactNode }) => children }));

import { CommunityReportForm } from "../../src/components/community-report-form";

const { mount, submit, setReason } = createCommunityReportIntentInteractionHelpers(
  harness,
  CommunityReportForm,
);

it("keeps the original report after a lost response and a rate-limited retry", async () => {
  await mount();
  setReason("Original report reason");
  harness.fetch.mockRejectedValueOnce(new Error("response lost"));
  await submit();
  const key = "nexus:report-intent:v1:usr_a:comment:cmt_a";
  const saved = sessionStorage.getItem(key);
  expect(saved).toContain("Original report reason");
  harness.fetch.mockResolvedValueOnce(response({ code: "RATE_LIMITED" }, 429));
  await submit();
  expect(sessionStorage.getItem(key)).toBe(saved);
  const posts = harness.fetch.mock.calls.filter(([path]) => path === "/api/workspace/reports");
  expect(posts).toHaveLength(2);
  expect(posts[1]?.[1].body).toBe(posts[0]?.[1].body);
  expect(posts[1]?.[1].headers["x-nexus-actor-id"]).toBe("usr_a");
});
