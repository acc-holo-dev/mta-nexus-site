vi.mock("server-only", () => ({}));

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ session: vi.fn(), get: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "token" }) }) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("../../src/lib/i18n-server", () => ({ getRequestLocale: async () => "en" }));
vi.mock("../../src/lib/services/auth-service", () => ({
  authService: { getSession: state.session },
}));
vi.mock("../../src/lib/services/author-content-service", () => ({
  authorContentService: { get: state.get },
}));
vi.mock("../../src/features/community/author-content-form", () => ({
  AuthorContentForm: ({ initial }: { initial?: { id: string } }) => (
    <div data-editor={initial?.id ?? "new"} />
  ),
}));
vi.mock("../../src/components/platform-sign-in", () => ({
  PlatformSignIn: ({ returnPath }: { returnPath: string }) => <div data-return-path={returnPath} />,
}));
vi.mock("../../src/lib/user-platform-client", () => ({
  parseEditableContent: (value: unknown) => value,
}));

import NewPage, { generateMetadata as newMetadata } from "../../src/app/workspace/content/new/page";
import EditPage, {
  generateMetadata as editMetadata,
} from "../../src/app/workspace/content/[id]/page";

beforeEach(() => {
  vi.clearAllMocks();
  state.session.mockResolvedValue(null);
});

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
