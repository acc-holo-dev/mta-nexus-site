import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import type { EditableContent } from "../../apps/web/src/lib/user-platform-client";
import { getUserPlatformCopy } from "../../apps/web/src/lib/user-platform-copy";

type AuthorContentFormConfirmHarness = {
  slots: unknown[];
  cursor: number;
  fetch: Mock;
  refresh: Mock;
  replace: Mock;
};

type Element = ReactElement<Record<string, unknown>>;

type ConfirmActionMock = Mock<(...args: unknown[]) => Promise<boolean>>;

export const time = "2026-10-11T00:00:00.000Z";
export const later = "2026-10-11T00:00:01.000Z";

export const initial = {
  id: "cnt_aaaaaaaaaaaaaaaaaaaaaaaa",
  title: "Draft article",
  slug: "draft-article",
  type: "article",
  status: "draft" as const,
  body: "A complete draft article body.",
  excerpt: "",
  coverImageUrl: "",
  tags: [] as string[],
  updatedAt: time,
};

/** Props match the fixture literals so real AuthorContentForm stays assignable. */
type AuthorContentFormComponent = (props: {
  locale: "en" | "ru";
  initial: typeof initial;
  organization?: { id: string; name: string };
  server?: { id: string; name: string };
}) => ReactNode;

export type AuthorContentFormScope = {
  organization?: { id: string; name: string };
  server?: { id: string; name: string };
};

export const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Shared react mock factory for author-content-form confirm suites. */
export function mockReactHooks(harness: AuthorContentFormConfirmHarness) {
  return async (original: () => Promise<typeof import("react")>) => ({
    ...(await original()),
    useState: (initialState: unknown) => {
      const index = harness.cursor++;
      if (!(index in harness.slots)) harness.slots[index] = initialState;
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
    useRef: (refInitial: unknown) => {
      const index = harness.cursor++;
      if (!(index in harness.slots)) harness.slots[index] = { current: refInitial };
      return harness.slots[index];
    },
    useEffect: () => {
      // Confirm coverage seeds slots directly; skip initial/latest sync effect.
    },
  });
}

function componentName(type: Element["type"]): string | undefined {
  if (typeof type === "string") return type;
  if (typeof type === "function") {
    const fn = type as { displayName?: string; name?: string };
    return fn.displayName ?? fn.name;
  }
  if (typeof type === "object" && type !== null) {
    return (type as { displayName?: string }).displayName;
  }
  return undefined;
}

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

export function findNamed(nodes: Element[], name: string) {
  const found = nodes.find((node) => componentName(node.type) === name);
  if (!found) throw new Error(`Missing ${name}`);
  return found;
}

/** Exact draft field values for FormData stubbing (no Record index bags). */
export function stubDraftFormData() {
  class DraftFormData {
    get(name: string) {
      if (name === "title") return "My draft title";
      if (name === "body") return "My unsaved publication body.";
      if (name === "excerpt") return "";
      if (name === "coverImageUrl") return "";
      if (name === "tags") return "";
      return null;
    }
  }
  vi.stubGlobal("FormData", DraftFormData);
}

export function createAuthorContentFormConfirmInteractionHelpers(
  harness: AuthorContentFormConfirmHarness,
  AuthorContentForm: AuthorContentFormComponent,
  confirmAction: ConfirmActionMock,
) {
  function seedForm(content: EditableContent = initial) {
    // saved, busy, notice, preview, latest, formRef, pending ref
    harness.slots = [content, false, null, null, null, { current: null }, { current: false }];
  }

  function render(locale: "en" | "ru" = "en", scope?: AuthorContentFormScope) {
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

  return {
    render,
    archiveButton,
    seedForm,
  };
}
