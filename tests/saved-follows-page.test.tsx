import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  actor: null as null | { id: string },
  locale: "en" as "ru" | "en",
  page: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.actor },
}));
vi.mock("../apps/web/src/lib/services/follow-workspace-service", () => ({
  followWorkspaceService: { page: state.page },
}));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));
vi.mock("../apps/web/src/components/follow-workspace", () => ({
  FollowWorkspace: ({
    initial,
    type,
    query,
  }: {
    initial: unknown;
    type?: string;
    query: string;
  }) => <div data-loaded={!!initial} data-type={type} data-query={query} />,
}));
import SavedPage, { generateMetadata } from "../apps/web/src/app/workspace/saved/page";
beforeEach(() => {
  vi.clearAllMocks();
  state.actor = null;
  state.locale = "en";
  state.page.mockResolvedValue({ items: [], hasMore: false, nextCursor: null });
});
it("renders a sign-in boundary without reading saved follows", async () => {
  expect(renderToStaticMarkup(await SavedPage())).toContain('href="/auth/login"');
  expect(state.page).not.toHaveBeenCalled();
});
it.each(["en", "ru"] as const)(
  "loads only the authenticated actor's normalized follow page in %s",
  async (locale) => {
    state.actor = { id: "actor" };
    state.locale = locale;
    const html = renderToStaticMarkup(
      await SavedPage({
        searchParams: Promise.resolve({ type: "organization", q: " Team ", userId: "other" }),
      }),
    );
    expect(state.page).toHaveBeenCalledWith("actor", {
      type: "organization",
      query: "Team",
      cursor: undefined,
    });
    expect(html).toContain('data-type="organization"');
    expect(html).toContain('data-query="Team"');
    expect((await generateMetadata()).robots.index).toBe(false);
  },
);
it("distinguishes a failed initial read from an empty saved list", async () => {
  state.actor = { id: "actor" };
  state.page.mockRejectedValue(new Error("database-secret"));
  const html = renderToStaticMarkup(await SavedPage());
  expect(html).toContain('data-loaded="false"');
  expect(html).not.toContain("database-secret");
});
