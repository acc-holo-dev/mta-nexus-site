import { expect, it, vi } from "vitest";
import {
  createOrganizationCreateRecoveryInteractionHelpers,
  mockReactHooks,
} from "./helpers/organization-create-recovery-interaction-harness";

const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effects: [] as (() => unknown)[],
  request: vi.fn(),
  fetch: vi.fn(),
  push: vi.fn(),
  actor: "usr_a",
}));
vi.mock("react", (original) => mockReactHooks(h)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push, refresh: vi.fn() }) }));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("../apps/web/src/lib/organization-workspace-client", () => ({
  organizationRequest: h.request,
}));

import { OrganizationProfileForm } from "../apps/web/src/components/organization-profile-form";

const { render, mount } = createOrganizationCreateRecoveryInteractionHelpers(
  h,
  OrganizationProfileForm,
);

it("hides prior actor fields immediately when the mounted form receives another actor", async () => {
  await mount();
  const name = render().find((n) => n.props.id === "organization-name");
  if (!name) throw new Error("Missing name");
  (name.props.onChange as (e: unknown) => void)({ target: { value: "Private draft A" } });
  h.actor = "usr_b";
  expect(render().find((n) => n.props.id === "organization-name")).toBeUndefined();
  for (const effect of h.effects) effect();
  await vi.waitFor(() =>
    expect(render().find((n) => n.props.id === "organization-name")).toBeDefined(),
  );
  expect(render().find((n) => n.props.id === "organization-name")?.props.value).toBe("");
});
