import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import {
  createAuthorContentFormConfirmInteractionHelpers,
  findNamed,
  initial,
  later,
  mockReactHooks,
  response,
  stubDraftFormData,
} from "./helpers/author-content-form-confirm-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../site/src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: harness.refresh, replace: harness.replace }),
}));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));

import { AuthorContentForm } from "../site/src/components/author-content-form";
import { getUserPlatformCopy } from "../site/src/lib/user-platform-copy";

const { render, archiveButton } = createAuthorContentFormConfirmInteractionHelpers(
  harness,
  AuthorContentForm,
  confirmAction,
);

it("routes publication mutation failures through ErrorState and keeps success as status", async () => {
  const copy = getUserPlatformCopy("en");
  stubDraftFormData();
  harness.fetch.mockResolvedValueOnce(response({ code: "CONFLICT" }, 409));
  const form = render().find((node) => node.type === "form");
  if (!form) throw new Error("Missing publication form");
  await (form.props.onSubmit as (event: unknown) => Promise<void>)({
    preventDefault() {},
    currentTarget: {},
  });
  await vi.waitFor(() => expect(findNamed(render(), "ErrorState")).toBeDefined());
  expect(findNamed(render(), "ErrorState").props.title).toBeTruthy();
  expect(render().some((node) => node.props.role === "alert" && node.type === "p")).toBe(false);
  expect(
    render().some(
      (node) => node.type === "button" && node.props.children === copy.checkLatestContent,
    ),
  ).toBe(true);

  harness.fetch.mockResolvedValueOnce(
    response({
      success: true,
      content: { ...initial, status: "archived", updatedAt: later },
    }),
  );
  (archiveButton(render()).props.onClick as () => void)();
  await vi.waitFor(() =>
    expect(
      render().some(
        (node) =>
          node.type === "p" &&
          node.props.role === "status" &&
          node.props.children === copy.archivedNote,
      ),
    ).toBe(true),
  );
  expect(() => findNamed(render(), "ErrorState")).toThrow(/Missing ErrorState/);
});
