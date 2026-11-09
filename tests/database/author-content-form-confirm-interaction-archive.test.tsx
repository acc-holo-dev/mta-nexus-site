import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import {
  createAuthorContentFormConfirmInteractionHelpers,
  initial,
  later,
  mockReactHooks,
  response,
} from "../helpers/author-content-form-confirm-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../../apps/web/src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: harness.refresh, replace: harness.replace }),
}));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));

import { AuthorContentForm } from "../../apps/web/src/components/author-content-form";
import { getUserPlatformCopy } from "../../apps/web/src/lib/user-platform-copy";

const { render, archiveButton } = createAuthorContentFormConfirmInteractionHelpers(
  harness,
  AuthorContentForm,
  confirmAction,
);

it("confirms publication archive before DELETE", async () => {
  const copy = getUserPlatformCopy("en");
  harness.fetch.mockResolvedValueOnce(
    response({
      success: true,
      content: { ...initial, status: "archived", updatedAt: later },
    }),
  );

  (archiveButton(render()).props.onClick as () => void)();
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalled());

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.archive,
    object: initial.title,
    consequences: copy.archiveConfirm,
    confirmLabel: copy.archive,
    cancelLabel: copy.back,
    closeLabel: copy.back,
  });
  expect(harness.fetch).toHaveBeenCalledWith(
    `/api/workspace/content/${encodeURIComponent(initial.id)}`,
    expect.objectContaining({
      method: "DELETE",
      body: JSON.stringify({
        expectedUpdatedAt: initial.updatedAt,
        expectedStatus: initial.status,
      }),
    }),
  );
  expect(harness.refresh).toHaveBeenCalledOnce();
});

it("does not archive a publication when confirmation is cancelled", async () => {
  confirmAction.mockResolvedValueOnce(false);
  (archiveButton(render()).props.onClick as () => void)();
  await vi.waitFor(() => expect(confirmAction).toHaveBeenCalledTimes(1));
  expect(harness.fetch).not.toHaveBeenCalled();
  expect(harness.refresh).not.toHaveBeenCalled();
});
