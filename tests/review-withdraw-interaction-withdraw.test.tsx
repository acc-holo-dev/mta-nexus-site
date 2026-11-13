import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import {
  createReviewWithdrawInteractionHelpers,
  mockReactHooks,
  response,
} from "./helpers/review-withdraw-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as (() => void)[],
  fetch: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../site/src/components/confirm-action", () => ({
  confirmAction,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children }: { href: string; children: ReactNode }) =>
      React.createElement("a", { href }, children),
  };
});

import { ResourceReviewEditor } from "../site/src/components/resource-review-controls";

const { withdrawButton } = createReviewWithdrawInteractionHelpers(
  harness,
  ResourceReviewEditor,
  confirmAction,
);

it("withdraws a resource review only after confirmAction approves", async () => {
  harness.fetch.mockResolvedValueOnce(
    response({ id: "cmt_a", revision: 3, status: "withdrawn", action: "withdraw" }),
  );
  await (withdrawButton().props.onClick as () => Promise<void>)();
  expect(harness.fetch).toHaveBeenCalledTimes(1);
  expect(harness.fetch.mock.calls[0][0]).toBe("/api/library/review/prd_a");
  expect(JSON.parse(String(harness.fetch.mock.calls[0][1]?.body))).toMatchObject({
    action: "withdraw",
    expectedRevision: 2,
  });
});
