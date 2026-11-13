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
vi.mock("../site/src/lib/organization-workspace-client", () => ({
  organizationRequest: h.request,
}));

import { OrganizationProfileForm } from "../site/src/components/organization-profile-form";

const { render, mount, fillFields, submit } = createOrganizationCreateRecoveryInteractionHelpers(
  h,
  OrganizationProfileForm,
);

it("unlocks a first request rejected before creation", async () => {
  const { PlatformRequestError } = await import("../site/src/lib/user-platform-client");
  await mount();
  fillFields();
  h.request.mockRejectedValueOnce(
    new PlatformRequestError("Too many requests", "RATE_LIMIT_EXCEEDED"),
  );
  await submit();
  expect(sessionStorage.getItem("nexus:organization-create:v1:usr_a")).toBeNull();
  expect(render().some((n) => n.type === "button" && n.props.children === "Check result")).toBe(
    false,
  );
});
