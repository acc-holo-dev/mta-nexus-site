import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import {
  createAuthorContentFormConfirmInteractionHelpers,
  initial,
  later,
  mockReactHooks,
  response,
  stubDraftFormData,
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

const { render, seedForm } = createAuthorContentFormConfirmInteractionHelpers(
  harness,
  AuthorContentForm,
  confirmAction,
);

it.each(["en", "ru"] as const)(
  "keeps a draft while comparing a changed saved version in %s",
  async (locale) => {
    for (const scopeKind of ["personal", "organization", "server"] as const) {
      const organization =
        scopeKind === "organization" ? { id: "org_demo", name: "Team" } : undefined;
      const server = scopeKind === "server" ? { id: "srv_demo", name: "Server" } : undefined;
      const scope = { organization, server };
      const scoped = {
        ...initial,
        ...(organization ? { organizationId: organization.id } : {}),
        ...(server ? { serverId: server.id } : {}),
      };
      const latest = {
        ...scoped,
        title: "Changed elsewhere",
        body: "A changed saved publication body.",
        updatedAt: later,
      };
      const expectedPath = organization
        ? `/api/workspace/organizations/${organization.id}/content/${initial.id}`
        : server
          ? `/api/workspace/servers/${server.id}/content/${initial.id}`
          : `/api/workspace/content/${initial.id}`;
      const copy = getUserPlatformCopy(locale);
      stubDraftFormData();
      seedForm(scoped);
      harness.fetch.mockReset();
      harness.fetch.mockResolvedValueOnce(response({ code: "CONFLICT" }, 409));
      const form = render(locale, scope).find((node) => node.type === "form");
      if (!form) throw new Error("Missing publication form");
      await (form.props.onSubmit as (event: unknown) => Promise<void>)({
        preventDefault() {},
        currentTarget: {},
      });
      const check = render(locale, scope).find(
        (node) => node.type === "button" && node.props.children === copy.checkLatestContent,
      );
      if (!check) throw new Error("Missing saved version check");
      harness.fetch.mockResolvedValueOnce(response({ content: latest }));
      (check.props.onClick as () => void)();
      await vi.waitFor(() =>
        expect(
          render(locale, scope).some(
            (node) => node.type === "button" && node.props.children === copy.useLatestContent,
          ),
        ).toBe(true),
      );
      expect(harness.fetch.mock.calls[1]?.[0]).toBe(expectedPath);
      expect(harness.fetch.mock.calls[1]?.[1]).toMatchObject({ method: "GET" });
      const accept = render(locale, scope).find(
        (node) => node.type === "button" && node.props.children === copy.useLatestContent,
      );
      if (!accept) throw new Error("Missing accept button");
      (accept.props.onClick as () => void)();
      const nextForm = render(locale, scope).find((node) => node.type === "form");
      if (!nextForm) throw new Error("Missing publication form");
      expect(nextForm.key).toBe(form.key);
      harness.fetch.mockResolvedValueOnce(response({ code: "CONFLICT" }, 409));
      await (nextForm.props.onSubmit as (event: unknown) => Promise<void>)({
        preventDefault() {},
        currentTarget: {},
      });
      expect(JSON.parse(String(harness.fetch.mock.calls[2]?.[1]?.body))).toMatchObject({
        title: "My draft title",
        body: "My unsaved publication body.",
        expectedUpdatedAt: later,
      });
    }
  },
);

it("keeps an archived saved version read-only without clearing the draft", async () => {
  const copy = getUserPlatformCopy("en");
  harness.slots[2] = { text: copy.CONFLICT, error: true };
  harness.fetch.mockResolvedValueOnce(
    response({ content: { ...initial, status: "archived", updatedAt: later } }),
  );
  const check = render().find(
    (node) => node.type === "button" && node.props.children === copy.checkLatestContent,
  );
  if (!check) throw new Error("Missing saved version check");
  (check.props.onClick as () => void)();
  await vi.waitFor(() => expect(harness.slots[4]).not.toBeNull());
  const nodes = render();
  expect(
    nodes.some((node) => node.type === "button" && node.props.children === copy.useLatestContent),
  ).toBe(false);
  expect(
    nodes.find((node) => node.type === "button" && node.props.children === copy.save)?.props
      .disabled,
  ).toBe(true);
  expect(nodes.find((node) => node.type === "form")?.key).toBe(initial.id);
});
