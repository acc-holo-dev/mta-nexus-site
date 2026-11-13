import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import {
  createOrganizationWorkspaceConfirmInteractionHelpers,
  mockReactHooks,
} from "../helpers/organization-workspace-confirm-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  request: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../../site/src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: harness.push, refresh: harness.refresh }),
}));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock("../../site/src/lib/organization-workspace-client", () => ({
  organizationRequest: harness.request,
}));

import { OrganizationWorkspacePanel } from "../../site/src/components/organization-workspace";

const { clickLeave } = createOrganizationWorkspaceConfirmInteractionHelpers(
  harness,
  OrganizationWorkspacePanel,
  confirmAction,
);

it("does not leave the organization when confirmation is cancelled", async () => {
  confirmAction.mockResolvedValueOnce(false);
  clickLeave();
  await vi.waitFor(() => expect(confirmAction).toHaveBeenCalledTimes(1));
  expect(harness.request).not.toHaveBeenCalled();
  expect(harness.push).not.toHaveBeenCalled();
});
