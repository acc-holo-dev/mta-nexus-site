vi.mock("server-only", () => ({}));

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ session: vi.fn(), get: vi.fn(), locale: "en" as "en" | "ru" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "token" }) }) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("../../src/lib/platform/i18n-server", () => ({
  getRequestLocale: async () => state.locale,
}));
vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: { getSession: state.session },
}));
vi.mock("../../src/lib/services/organizations/author-content-service", () => ({
  authorContentService: { get: state.get },
}));
vi.mock("../../src/features/community/author-content-form", () => ({
  AuthorContentForm: ({ initial }: { initial?: { id: string } }) => (
    <div data-editor={initial?.id ?? "new"} />
  ),
}));
vi.mock("../../src/features/shell/guest-auth", () => ({
  PlatformSignIn: ({ returnPath }: { returnPath: string }) => <div data-return-path={returnPath} />,
}));
vi.mock("../../src/features/community/user-platform-client", () => ({
  parseEditableContent: (value: unknown) => value,
}));

import EditPage, {
  generateMetadata as editMetadata,
} from "../../src/app/workspace/content/[id]/page";
import NewPage, { generateMetadata as newMetadata } from "../../src/app/workspace/content/new/page";
import { getUserPlatformCopy } from "../../src/features/community/user-platform-copy";
import { getDictionary } from "../../src/lib/platform/i18n";

beforeEach(() => {
  vi.clearAllMocks();
  state.session.mockResolvedValue(null);
  state.locale = "en";
});

it.each(["en", "ru"] as const)(
  "offers localized retry without exposing the editor when session lookup fails in %s",
  async (locale) => {
    state.locale = locale;
    state.session.mockRejectedValue(new Error("PRIVATE_SESSION"));
    const create = renderToStaticMarkup(await NewPage());
    const edit = renderToStaticMarkup(await EditPage({ params: Promise.resolve({ id: "draft" }) }));
    const copy = getUserPlatformCopy(locale);
    expect(create).toContain(`>${copy.create}</h1>`);
    expect(edit).toContain(`>${copy.edit}</h1>`);
    for (const html of [create, edit]) {
      expect(html).toContain(copy.unavailable);
      expect(html).toContain(getDictionary(locale).errors.retry);
      expect(html).not.toContain("data-editor");
      expect(html).not.toContain("data-return-path");
      expect(html).not.toContain("PRIVATE_SESSION");
    }
    expect(create).toContain('href="/workspace/content/new"');
    expect(edit).toContain('href="/workspace/content/draft"');
    expect(state.get).not.toHaveBeenCalled();
  },
);

it("requires a session before exposing the create or edit form", async () => {
  const create = renderToStaticMarkup(await NewPage());
  const edit = renderToStaticMarkup(
    await EditPage({ params: Promise.resolve({ id: "draft/one" }) }),
  );
  expect(create).toContain('data-return-path="/workspace/content/new"');
  expect(edit).toContain('data-return-path="/workspace/content/draft%2Fone"');
  expect(create).not.toContain("data-editor");
  expect(edit).not.toContain("data-editor");
  expect(state.get).not.toHaveBeenCalled();
});

it("loads the editor through the authenticated actor and preserves private metadata", async () => {
  const actor = { id: "actor", role: "user" };
  state.session.mockResolvedValue(actor);
  state.get.mockResolvedValue({ id: "draft" });
  const create = renderToStaticMarkup(await NewPage());
  const edit = renderToStaticMarkup(await EditPage({ params: Promise.resolve({ id: "draft" }) }));
  expect(create).toContain('data-editor="new"');
  expect(edit).toContain('data-editor="draft"');
  expect(state.get).toHaveBeenCalledWith("draft", actor);
  expect(await newMetadata()).toMatchObject({ robots: { index: false, follow: false } });
  expect(await editMetadata()).toMatchObject({ robots: { index: false, follow: false } });
});
