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

const { render, mount, fillFields, submit, checkResultButton } =
  createOrganizationCreateRecoveryInteractionHelpers(h, OrganizationProfileForm);

it("locks an unknown creation outcome across reload and does not retry after inconclusive recovery", async () => {
  await mount();
  fillFields();
  h.request.mockRejectedValueOnce(new Error("lost response"));
  await submit();
  expect(sessionStorage.getItem("nexus:organization-create:v1:usr_a")).toContain("my-organization");
  expect(h.request).toHaveBeenCalledTimes(1);
  h.slots = [];
  render();
  for (const effect of h.effects) effect();
  await vi.waitFor(() => expect(checkResultButton()).toBeDefined());
  const retry = checkResultButton();
  h.request.mockResolvedValueOnce({ organization: null });
  await (retry.props.onClick as () => Promise<void>)();
  await vi.waitFor(() => expect(h.request).toHaveBeenCalledTimes(2));
  await submit();
  expect(h.request).toHaveBeenCalledTimes(2);
  expect(sessionStorage.getItem("nexus:organization-create:v1:usr_a")).not.toBeNull();
});
