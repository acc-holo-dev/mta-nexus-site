import { expect, it, vi } from "vitest";
import {
  createOrganizationCreateRecoveryInteractionHelpers,
  mockReactHooks,
} from "../helpers/organization-create-recovery-interaction-harness";

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
vi.mock("../../site/src/lib/organization-workspace-client", () => ({
  organizationRequest: h.request,
}));

import { OrganizationProfileForm } from "../../site/src/components/organization-profile-form";

const { render, checkResultButton } = createOrganizationCreateRecoveryInteractionHelpers(
  h,
  OrganizationProfileForm,
);

it("clears the recovered intent before SPA navigation without pagehide", async () => {
  sessionStorage.setItem(
    "nexus:organization-create:v1:usr_a",
    JSON.stringify({
      actorId: "usr_a",
      nonce: "a".repeat(32),
      fields: {
        name: "My organization",
        slug: "my-organization",
        description: "",
        logoUrl: "",
        websiteUrl: "",
      },
    }),
  );
  h.fetch.mockImplementation(
    async () => new Response(JSON.stringify({ authenticated: true, user: { id: "usr_a" } })),
  );
  render();
  for (const effect of h.effects) effect();
  await vi.waitFor(() => expect(checkResultButton()).toBeDefined());
  h.request.mockResolvedValueOnce({ organization: { id: "org_1" } });
  (checkResultButton().props.onClick as () => void)();
  await vi.waitFor(() => expect(h.push).toHaveBeenCalledWith("/workspace/organizations/org_1"));
  expect(sessionStorage.getItem("nexus:organization-create:v1:usr_a")).toBeNull();
});
