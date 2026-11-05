import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import {
  createCommunityReportIntentInteractionHelpers,
  mockReactHooks,
} from "./helpers/community-report-intent-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effects: [] as (() => unknown)[],
  fetch: vi.fn(),
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ usePathname: () => "/articles/topic" }));
vi.mock("next/link", () => ({ default: ({ children }: { children: ReactNode }) => children }));

import { CommunityReportForm } from "../apps/web/src/components/community-report-form";

const { mount, submit, setReason } = createCommunityReportIntentInteractionHelpers(
  harness,
  CommunityReportForm,
);

it("does not send when the pending intent cannot be stored", async () => {
  await mount();
  setReason("Original report reason");
  vi.stubGlobal("sessionStorage", {
    getItem: () => null,
    setItem: () => {
      throw new Error("denied");
    },
    removeItem: () => {},
  });
  await submit();
  expect(
    harness.fetch.mock.calls.filter(([path]) => path === "/api/workspace/reports"),
  ).toHaveLength(0);
});
