import { expect, it, vi } from "vitest";
import {
  createPlanReviewRecoveryInteractionHelpers,
  mockReactHooks,
  reply,
  responseFor,
} from "./helpers/plan-review-recovery-interaction-harness";

const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effects: [] as (() => unknown)[],
  fetch: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  locale: "en" as "en" | "ru",
}));
vi.mock("react", (original) => mockReactHooks(h)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push, refresh: h.refresh }) }));
vi.mock("../site/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: h.locale }),
}));

import { PlanReviewForm } from "../site/src/components/plan-review-form";

const { render, mount, submit, reviewPosts } = createPlanReviewRecoveryInteractionHelpers(
  h,
  PlanReviewForm,
);

it("does not send under a different actor or reveal the saved selection", async () => {
  await mount();
  h.fetch.mockRejectedValueOnce(new Error("lost"));
  await submit();
  const saved = sessionStorage.getItem("nexus:plan-review:v1:usr_a:cplan_a");
  h.slots = [];
  h.fetch.mockResolvedValueOnce(reply({ authenticated: true, user: { id: "usr_b" } }));
  render("usr_a");
  for (const effect of h.effects) effect();
  await vi.waitFor(() =>
    expect(
      render("usr_a").some(
        (node) =>
          typeof node.props.title === "string" && node.props.title.includes("Could not verify"),
      ),
    ).toBe(true),
  );
  expect(render("usr_a").find((node) => node.type === "form")?.props.hidden).toBe(true);
  expect(sessionStorage.getItem("nexus:plan-review:v1:usr_a:cplan_a")).toBe(saved);
});

it("ignores a late response after the form receives another actor", async () => {
  await mount();
  let complete!: (value: Response) => void;
  h.fetch.mockReturnValueOnce(
    new Promise<Response>((resolve) => {
      complete = resolve;
    }),
  );
  const pending = submit();
  await vi.waitFor(() => expect(reviewPosts()).toHaveLength(1));
  const post = h.fetch.mock.calls.find(([url]) => url === "/api/subscriptions/reviews");
  const command = JSON.parse(String(post?.[1].body));
  expect(render("usr_b").find((node) => node.type === "form")?.props.hidden).toBe(true);
  complete(responseFor(command));
  await pending;
  expect(h.push).not.toHaveBeenCalled();
  expect(h.refresh).not.toHaveBeenCalled();
  expect(sessionStorage.getItem("nexus:plan-review:v1:usr_a:cplan_a")).not.toBeNull();
});
