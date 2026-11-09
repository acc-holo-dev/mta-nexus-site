import { expect, it, vi } from "vitest";
import { findTestButton } from "../helpers/flatten-react-test-tree";
import {
  actor,
  createOrganizationProfileDraftInteractionHelpers,
  latest,
  mockReactHooks,
} from "../helpers/organization-profile-draft-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  request: vi.fn(),
  onSave: vi.fn(),
  onBusy: vi.fn(),
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("../../apps/web/src/lib/organization-workspace-client", () => ({
  organizationRequest: harness.request,
}));

import { OrganizationProfileForm } from "../../apps/web/src/components/organization-profile-form";
import { getOrganizationCopy } from "../../apps/web/src/lib/organization-workspace-copy";

const { render, edit } = createOrganizationProfileDraftInteractionHelpers(
  harness,
  OrganizationProfileForm,
);

it("does not disclose the draft to a different actor during verification", async () => {
  const copy = getOrganizationCopy("en");
  edit();
  harness.request.mockResolvedValueOnce({ profile: { ...actor, id: "usr_2" } });
  (findTestButton(render(latest, false), copy.profileVerify).props.onClick as () => void)();
  await vi.waitFor(() =>
    expect(
      render(latest, false).some((node) => node.props.title === copy.profileActorChanged),
    ).toBe(true),
  );
  expect(render(latest, false).some((node) => node.props.value === "Unsaved draft name")).toBe(
    false,
  );
  expect(harness.request).toHaveBeenCalledTimes(1);
});
