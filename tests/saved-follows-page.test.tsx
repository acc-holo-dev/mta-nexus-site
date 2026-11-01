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
    sectionLabelledBy,
  }: {
    initial: unknown;
    type?: string;
    query: string;
    sectionLabelledBy?: string;
  }) => (
    <div
      data-loaded={!!initial}
      data-type={type}
      data-query={query}
      {...(sectionLabelledBy ? { "aria-labelledby": sectionLabelledBy } : {})}
    />
  ),
}));

import SavedLoading from "../apps/web/src/app/workspace/saved/loading";
import SavedPage, { generateMetadata } from "../apps/web/src/app/workspace/saved/page";
import { followCopy } from "../apps/web/src/lib/follow-workspace-copy";

beforeEach(() => {
  vi.clearAllMocks();
  state.actor = null;
  state.locale = "en";
  state.page.mockResolvedValue({ items: [], hasMore: false, nextCursor: null });
});
it.each(["en", "ru"] as const)(
  "keeps filter-empty and add-to-collection copy distinct from plain empty in %s",
  (locale) => {
    const copy = followCopy(locale);
    expect(copy.emptyFiltered).not.toBe(copy.empty);
    expect(copy.emptyFilteredHint.length).toBeGreaterThan(0);
    expect(copy.toCollection.length).toBeGreaterThan(0);
    expect(copy.toCollectionHint).toMatch(/does not turn on|не включает/u);
  },
);
it("renders a sign-in boundary without reading saved follows", async () => {
  expect(renderToStaticMarkup(await SavedPage({}))).toContain(
    'href="/auth/login?next=%2Fworkspace%2Fsaved"',
  );
  expect(state.page).not.toHaveBeenCalled();
});
it("preserves saved filters in the guest login return path", async () => {
  const html = renderToStaticMarkup(
    await SavedPage({
      searchParams: Promise.resolve({ type: "organization", q: "Team" }),
    }),
  );
  expect(html).toContain(
    'href="/auth/login?next=%2Fworkspace%2Fsaved%3Ftype%3Dorganization%26q%3DTeam"',
  );
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
    expect(html).toContain('id="saved-follows-heading"');
    expect(html).toContain('aria-labelledby="saved-follows-heading"');
    expect((await generateMetadata()).robots.index).toBe(false);
  },
);
it("distinguishes a failed initial read from an empty saved list", async () => {
  state.actor = { id: "actor" };
  state.page.mockRejectedValue(new Error("database-secret"));
  const html = renderToStaticMarkup(await SavedPage({}));
  expect(html).toContain('data-loaded="false"');
  expect(html).not.toContain("database-secret");
});
it.each(["en", "ru"] as const)(
  "renders an honest saved loading shell with visible title in %s",
  async (locale) => {
    state.locale = locale;
    const copy = followCopy(locale);
    const html = renderToStaticMarkup(await SavedLoading());
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('id="saved-follows-loading-heading"');
    expect(html).toContain('aria-labelledby="saved-follows-loading-heading"');
    expect(html).toContain(`>${copy.title}<`);
    expect(html).toContain(copy.loading);
  },
);
