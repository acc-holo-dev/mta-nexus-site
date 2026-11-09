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

import { CommunityReportForm } from "../../apps/web/src/components/community-report-form";

const { render, mount, submit, setReason } = createCommunityReportIntentInteractionHelpers(
  harness,
  CommunityReportForm,
);

it("unlocks the report when the first attempt is definitely rejected", async () => {
  await mount();
  setReason("Original report reason");
  harness.fetch.mockResolvedValueOnce(response({ code: "RATE_LIMITED" }, 429));
  await submit();
  expect(sessionStorage.getItem("nexus:report-intent:v1:usr_a:comment:cmt_a")).toBeNull();
  expect(render().find((node) => node.type === "textarea")?.props.disabled).toBe(false);
});
