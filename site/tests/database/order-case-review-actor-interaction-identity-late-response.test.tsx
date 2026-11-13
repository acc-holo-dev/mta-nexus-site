import { expect, it, vi } from "vitest";
import {
  createOrderCaseReviewActorInteractionHelpers,
  mockReactHooks,
  reviewReceipt,
} from "../helpers/order-case-review-actor-interaction-harness";

const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  actor: "usr_a",
  fetch: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("react", (original) => mockReactHooks(h)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: h.refresh, push: vi.fn() }) }));

import { OrderCaseReviewForm } from "../../src/components/order-case-forms";

const { render, prepare, review } = createOrderCaseReviewActorInteractionHelpers(
  h,
  OrderCaseReviewForm,
);

it("ignores a late review response after identity changes", async () => {
  let complete!: (value: unknown) => void;
  h.fetch.mockReturnValueOnce(
    new Promise((resolve) => {
      complete = resolve;
    }),
  );
  prepare();
  review();
  expect(h.fetch.mock.calls[0][1].headers["x-nexus-actor-id"]).toBe("usr_a");
  h.actor = "usr_b";
  expect(render()).toHaveLength(0);
  complete({ ok: true, status: 200, json: async () => reviewReceipt("usr_a") });
  await Promise.resolve();
  await Promise.resolve();
  expect(render().some((n) => n.props.role === "status")).toBe(false);
});
