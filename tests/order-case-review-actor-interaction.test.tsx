import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { flattenReactTestTree } from "./helpers/flatten-react-test-tree";
const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  actor: "usr_a",
  fetch: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const i = h.cursor++;
    if (!(i in h.slots)) h.slots[i] = initial;
    return [
      h.slots[i],
      (value: unknown) => {
        h.slots[i] = typeof value === "function" ? value(h.slots[i]) : value;
      },
    ];
  },
  useRef: (initial: unknown) => {
    const i = h.cursor++;
    if (!(i in h.slots)) h.slots[i] = { current: initial };
    return h.slots[i];
  },
  useEffect: () => {},
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: h.refresh, push: vi.fn() }) }));
import { OrderCaseReviewForm } from "../apps/web/src/components/order-case-forms";
function render() {
  h.cursor = 0;
  return flattenReactTestTree(
    OrderCaseReviewForm({
      actorId: h.actor,
      caseId: "sup_a",
      reviewStatus: "intake",
      revision: 1,
      supportUpdatedAt: "2026-10-11T00:00:00.000Z",
      evidenceHash: "a".repeat(64),
      threadStatus: "open",
      canRecommendRefund: false,
      monetary: false,
      recommendationEligible: false,
      locale: "en",
    }) as ReactNode,
  );
}
function prepare() {
  const notes = render().find((n) => n.type === "textarea");
  if (!notes) throw Error("Missing notes");
  (notes.props.onChange as (e: unknown) => void)({ target: { value: "Reviewed records" } });
}
function review() {
  const button = render().find((n) => n.type === "button" && n.props.children === "Start review");
  if (!button) throw Error("Missing review");
  (button.props.onClick as () => void)();
}
const receipt = (actorId: string) => ({
  actorId,
  kind: "order_case_reviewed",
  caseId: "sup_a",
  action: "start_review",
  reviewStatus: "reviewing",
  revision: 2,
  threadStatus: "open",
  supportUpdatedAt: "2026-10-11T00:00:00.001Z",
  financialExecution: false,
});
beforeEach(() => {
  h.slots = [];
  h.actor = "usr_a";
  h.fetch.mockReset();
  h.refresh.mockReset();
  vi.stubGlobal("fetch", h.fetch);
});
afterEach(() => vi.unstubAllGlobals());
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
  complete({ ok: true, status: 200, json: async () => receipt("usr_a") });
  await Promise.resolve();
  await Promise.resolve();
  expect(render().some((n) => n.props.role === "status")).toBe(false);
});
it("does not confirm a receipt belonging to another actor", async () => {
  h.fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => receipt("usr_b") });
  prepare();
  review();
  await vi.waitFor(() => expect(render().some((n) => n.props.role === "alert")).toBe(true));
  expect(render().some((n) => n.props.role === "status")).toBe(false);
});
