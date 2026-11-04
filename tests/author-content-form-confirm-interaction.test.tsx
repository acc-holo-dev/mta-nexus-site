import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../apps/web/src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.slots)) harness.slots[index] = initial;
    return [
      harness.slots[index],
      (value: unknown) => {
        harness.slots[index] =
          typeof value === "function"
            ? (value as (current: unknown) => unknown)(harness.slots[index])
            : value;
      },
    ];
  },
  useRef: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.slots)) harness.slots[index] = { current: initial };
    return harness.slots[index];
  },
  useEffect: () => {},
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: harness.refresh, replace: harness.replace }),
}));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));

import { AuthorContentForm } from "../apps/web/src/components/author-content-form";
import type { EditableContent } from "../apps/web/src/lib/user-platform-client";
import { getUserPlatformCopy } from "../apps/web/src/lib/user-platform-copy";

type Element = ReactElement<Record<string, unknown>>;

const time = "2026-10-11T00:00:00.000Z";
const later = "2026-10-11T00:00:01.000Z";

const initial: EditableContent = {
  id: "cnt_aaaaaaaaaaaaaaaaaaaaaaaa",
  title: "Draft article",
  slug: "draft-article",
  type: "article",
  status: "draft",
  body: "A complete draft article body.",
  excerpt: "",
  coverImageUrl: "",
  tags: [],
  updatedAt: time,
};

function descendants(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(descendants);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Element;
  const type = element.type as { displayName?: string } | string;
  if (typeof type === "object" && type?.displayName === "Button") {
    return [
      { ...element, type: "button" } as Element,
      ...descendants(element.props.children as ReactNode),
    ];
  }
  return [element, ...descendants(element.props.children as ReactNode)];
}

function seedForm(content: EditableContent = initial) {
  // saved, busy, notice, preview, latest, formRef, pending ref
  harness.slots = [content, false, null, null, null, { current: null }, { current: false }];
}

function render(
  locale: "en" | "ru" = "en",
  scope?: { organization?: { id: string; name: string }; server?: { id: string; name: string } },
) {
  harness.cursor = 0;
  return descendants(AuthorContentForm({ locale, initial, ...scope }));
}

function archiveButton(nodes: Element[]) {
  const copy = getUserPlatformCopy("en");
  const found = nodes.find(
    (node) => node.type === "button" && node.props.children === copy.archive,
  );
  if (!found) throw new Error("Missing archive button");
  return found;
}

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  vi.clearAllMocks();
  harness.cursor = 0;
  seedForm();
  confirmAction.mockResolvedValue(true);
  harness.fetch.mockReset();
  harness.refresh.mockReset();
  harness.replace.mockReset();
  vi.stubGlobal("fetch", harness.fetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

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
      class DraftFormData {
        get(name: string) {
          return (
            (
              {
                title: "My draft title",
                body: "My unsaved publication body.",
                excerpt: "",
                coverImageUrl: "",
                tags: "",
              } as Record<string, string>
            )[name] ?? null
          );
        }
      }
      vi.stubGlobal("FormData", DraftFormData);
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
