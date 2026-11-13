import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import {
  createCommunityReportIntentInteractionHelpers,
  mockReactHooks,
  response,
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

import { CommunityReportForm } from "../site/src/components/community-report-form";

const { render, mount, submit, setReason } = createCommunityReportIntentInteractionHelpers(
  harness,
  CommunityReportForm,
);

it("hides the form if the account changed before restoring", async () => {
  harness.fetch.mockResolvedValueOnce(response({ authenticated: true, user: { id: "usr_b" } }));
  render();
  for (const effect of harness.effects) effect();
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalled());
  const open = render().find((node) => node.props.onClick);
  if (!open) throw Error("Missing report button");
  (open.props.onClick as () => void)();
  await vi.waitFor(() => expect(render().find((node) => node.type === "form")).toBeUndefined());
});

it("hides and clears the old actor's pending report when the actor changes", async () => {
  await mount();
  setReason("Private reason for actor A");
  harness.fetch.mockRejectedValueOnce(new Error("response lost"));
  await submit();
  expect(sessionStorage.getItem("nexus:report-intent:v1:usr_a:comment:cmt_a")).toContain(
    "Private reason for actor A",
  );
  harness.fetch.mockResolvedValueOnce(response({ authenticated: true, user: { id: "usr_b" } }));
  expect(render("usr_b").find((node) => node.type === "form")).toBeUndefined();
  for (const effect of harness.effects) effect();
  await vi.waitFor(() =>
    expect(render("usr_b").find((node) => node.type === "form")).toBeDefined(),
  );
  const nextReason = render("usr_b").find((node) => node.type === "textarea");
  expect(nextReason?.props.value).toBe("");
  expect(sessionStorage.getItem("nexus:report-intent:v1:usr_b:comment:cmt_a")).toBeNull();
  expect(sessionStorage.getItem("nexus:report-intent:v1:usr_a:comment:cmt_a")).toContain(
    "Private reason for actor A",
  );
});
