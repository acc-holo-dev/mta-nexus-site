import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import {
  createCommunityReportDetailConfirmInteractionHelpers,
  mockReactHooks,
  notes,
} from "./helpers/community-report-detail-confirm-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  request: vi.fn(),
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock("../site/src/lib/user-platform-client", async (original) => {
  const actual = await original<typeof import("../site/src/lib/user-platform-client")>();
  return {
    ...actual,
    platformRequest: harness.request,
  };
});

import { CommunityReportDetailView } from "../site/src/components/community-report-detail";
import { communityReportCopy } from "../site/src/lib/community-report-copy";

const { render, clickCancel } = createCommunityReportDetailConfirmInteractionHelpers(
  harness,
  CommunityReportDetailView,
);

it("clears the decide confirmation without changing decide or fetch state", () => {
  const copy = communityReportCopy("en");
  const nodes = render();
  expect(nodes.some((node) => node.props["aria-label"] === copy.confirm)).toBe(true);
  expect(harness.slots[4]).toEqual({
    action: "resolve",
    notes,
    expectedStatus: "open",
  });

  const reportBefore = harness.slots[0];
  const notesBefore = harness.slots[1];
  const pendingBefore = harness.slots[2];
  const errorBefore = harness.slots[3];
  const successBefore = harness.slots[5];
  const needsReloadBefore = harness.slots[6];
  const guardBefore = structuredClone(harness.slots[7]);
  const controllerBefore = structuredClone(harness.slots[8]);

  clickCancel(nodes);

  expect(harness.slots[4]).toBeNull();
  expect(harness.slots[0]).toBe(reportBefore);
  expect(harness.slots[1]).toBe(notesBefore);
  expect(harness.slots[1]).toBe(notes);
  expect(harness.slots[2]).toBe(pendingBefore);
  expect(harness.slots[3]).toBe(errorBefore);
  expect(harness.slots[5]).toBe(successBefore);
  expect(harness.slots[6]).toBe(needsReloadBefore);
  expect(harness.slots[7]).toEqual(guardBefore);
  expect(harness.slots[8]).toEqual(controllerBefore);
  expect(harness.request).not.toHaveBeenCalled();

  const after = render();
  expect(after.some((node) => node.props["aria-label"] === copy.confirm)).toBe(false);
  expect(after.some((node) => node.type === "button" && node.props.children === copy.resolve)).toBe(
    true,
  );
});
