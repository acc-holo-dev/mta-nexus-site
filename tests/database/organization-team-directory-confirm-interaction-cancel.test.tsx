import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import {
  createOrganizationTeamDirectoryConfirmInteractionHelpers,
  mockReactHooks,
} from "../helpers/organization-team-directory-confirm-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  request: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../../apps/web/src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock("../../apps/web/src/lib/organization-workspace-client", () => ({
  organizationRequest: harness.request,
}));

import { OrganizationTeamDirectory } from "../../apps/web/src/components/organization-team-directory";

const { render, memberEditor } = createOrganizationTeamDirectoryConfirmInteractionHelpers(
  harness,
  OrganizationTeamDirectory,
  confirmAction,
);

it("does not remove a member when confirmation is cancelled", async () => {
  confirmAction.mockResolvedValueOnce(false);
  await (memberEditor(render()).props.onRemove as () => Promise<void>)();
  await vi.waitFor(() => expect(confirmAction).toHaveBeenCalledTimes(1));
  expect(harness.request).not.toHaveBeenCalled();
});
