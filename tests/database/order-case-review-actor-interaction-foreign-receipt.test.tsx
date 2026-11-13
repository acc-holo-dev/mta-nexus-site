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

import { OrderCaseReviewForm } from "../../site/src/components/order-case-forms";

const { render, prepare, review } = createOrderCaseReviewActorInteractionHelpers(
  h,
  OrderCaseReviewForm,
);

it("does not confirm a receipt belonging to another actor", async () => {
  h.fetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => reviewReceipt("usr_b"),
  });
  prepare();
  review();
  await vi.waitFor(() => expect(render().some((n) => n.props.role === "alert")).toBe(true));
  expect(render().some((n) => n.props.role === "status")).toBe(false);
});
