import { AppError } from "@nexus/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { ContentReactions } from "../../apps/web/src/components/content-reactions";
import { PublicUserTrustPanel } from "../../apps/web/src/components/public-user-trust";
import { reactionCopy } from "../../apps/web/src/lib/content-reaction-copy";
import { getDictionary } from "../../apps/web/src/lib/i18n";
import { trustCopy } from "../../apps/web/src/lib/public-user-trust-copy";

const mocks = vi.hoisted(() => ({
  locale: "en" as "en" | "ru",
  session: vi.fn(),
  page: vi.fn(),
  trust: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "token" }) }) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  usePathname: () => "/articles/guide",
}));
vi.mock("../../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: mocks.session },
}));
vi.mock("../../apps/web/src/lib/services/content-reaction-service", () => ({
  contentReactionService: { page: mocks.page },
}));
vi.mock("../../apps/web/src/lib/services/public-user-trust-service", () => ({
  publicUserTrustService: { get: mocks.trust },
}));
vi.mock("../../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => mocks.locale }));

import TrustPage, {
  generateMetadata as trustMetadata,
} from "../../apps/web/src/app/users/[username]/trust/page";
import ReactionsLoading from "../../apps/web/src/app/workspace/reactions/loading";
import ReactionsPage, { generateMetadata } from "../../apps/web/src/app/workspace/reactions/page";

const saved = {
  contentId: "content",
  slug: "guide",
  authenticated: true,
  actorId: "actor",
  self: false,
  reaction: "thanks" as const,
  counts: { helpful: 2, thanks: 3, insight: 0 },
};
const trustData = {
  user: {
    username: "writer",
    displayName: "Writer",
    avatarUrl: null,
    joinedAt: "2026-01-01T00:00:00.000Z",
  },
  identity: { verified: true, latestRecordedApprovalAt: null },
  developer: { verified: false, latestRecordedApprovalAt: null },
  servers: { total: 2, verified: 1 },
  organizations: { total: 1, verified: 0 },
  publications: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.locale = "en";
  mocks.session.mockResolvedValue({ id: "actor" });
  mocks.page.mockResolvedValue({
    items: [
      {
        contentId: "content",
        reaction: "thanks",
        reactedAt: "2026-10-11T00:00:00.000Z",
        title: null,
        slug: null,
        type: null,
      },
    ],
    hasMore: true,
    nextCursor: "next",
  });
  mocks.trust.mockResolvedValue(trustData);
});
it.each(["en", "ru"] as const)(
  "renders selected reaction, actual counters and accessible recovery in %s",
  (locale) => {
    const html = renderToStaticMarkup(
      <ContentReactions slug="guide" contentId="content" initial={saved} locale={locale} />,
    );
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain(reactionCopy(locale).thanks);
    expect(html).toContain(reactionCopy(locale).remove);
    expect(html).toContain(reactionCopy(locale).reload);
    expect(html).toContain("bg-accent-soft");
    expect(html).toContain("rounded-lg");
    expect(html).toContain('href="/workspace/reactions"');
  },
);
it("shows sign-in for guests and disables votes for an author while allowing old-vote removal", () => {
  const guest = renderToStaticMarkup(
    <ContentReactions
      slug="guide"
      contentId="content"
      initial={{ ...saved, authenticated: false, actorId: null, reaction: null }}
      locale="en"
    />,
  );
  expect(guest).toContain('href="/auth/login?next=%2Farticles%2Fguide"');
  expect(guest).toContain('href="/auth/register?next=%2Farticles%2Fguide"');
  expect(guest).toContain(getDictionary("en").workspace.createAccount);
  expect(guest.match(/disabled=""/gu)).toHaveLength(3);
  const own = renderToStaticMarkup(
    <ContentReactions
      slug="guide"
      contentId="content"
      initial={{ ...saved, self: true }}
      locale="ru"
    />,
  );
  expect(own).toContain(reactionCopy("ru").own);
  expect(own.match(/disabled=""/gu)).toHaveLength(3);
  expect(own).toContain(reactionCopy("ru").remove);
});
it("keeps writes disabled with an explicit ErrorState when saved state cannot load", () => {
  const html = renderToStaticMarkup(
    <ContentReactions slug="guide" contentId="content" initial={null} locale="en" />,
  );
  expect(html).toContain('role="alert"');
  expect(html).toContain("bg-danger-soft");
  expect(html).toContain(reactionCopy("en").unavailable);
  expect(html).not.toContain('<p role="alert"');
  expect(html.match(/disabled=""/gu)).toHaveLength(3);
  expect(html).not.toContain('aria-pressed="true"');
});
it.each(["en", "ru"] as const)(
  "renders private cleanup, filters, continuation and no-index metadata in %s",
  async (locale) => {
    mocks.locale = locale;
    const html = renderToStaticMarkup(
      await ReactionsPage({ searchParams: Promise.resolve({ q: "Lua", reaction: "thanks" }) }),
    );
    const copy = reactionCopy(locale);
    expect(html).toContain(copy.hidden);
    expect(html).toContain(copy.hiddenDescription);
    expect(html).toContain('id="workspace-reactions-publication-unavailable"');
    expect(html).toContain('role="alert"');
    expect(html).toContain(copy.remove);
    expect(html).toContain(`<search aria-label="${copy.query}"`);
    expect(html).toContain('name="q"');
    expect(html).toContain('name="reaction"');
    expect(html).toContain("cursor=next");
    expect(html).not.toContain('href="/articles/');
    expect(await generateMetadata()).toMatchObject({
      title: copy.my,
      robots: { index: false, follow: false },
    });
  },
);
it("does not fetch private reactions for an anonymous viewer", async () => {
  mocks.session.mockResolvedValue(null);
  expect(renderToStaticMarkup(await ReactionsPage({}))).toContain(
    'href="/auth/login?next=%2Fworkspace%2Freactions"',
  );
  expect(mocks.page).not.toHaveBeenCalled();
});
it("rejects duplicate/unknown SSR parameters and provides a fresh-state recovery link", async () => {
  const html = renderToStaticMarkup(
    await ReactionsPage({ searchParams: Promise.resolve({ q: ["a", "b"] }) }),
  );
  expect(html).toContain('role="alert"');
  expect(mocks.page).not.toHaveBeenCalled();
  expect(html).toContain('href="/workspace/reactions"');
  expect(html).toContain(getDictionary("en").errors.retry);
  mocks.page.mockRejectedValue(new AppError("private filter", 400, "INVALID_CURSOR"));
  expect(renderToStaticMarkup(await ReactionsPage({}))).toContain(reactionCopy("en").invalid);
});
it("shows an honest recovery state when private reactions fail to load", async () => {
  mocks.page.mockRejectedValueOnce(new Error("reactions unavailable"));
  const copy = reactionCopy("en");
  const html = renderToStaticMarkup(await ReactionsPage({}));
  expect(html).toContain('role="alert"');
  expect(html).toContain(copy.unavailable);
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain(getDictionary("en").errors.retry);
  expect(html).toContain('href="/workspace/reactions"');
  expect(html).not.toContain("reactions unavailable");
});
it("shows EmptyState descriptions for empty and filtered reactions", async () => {
  const copy = reactionCopy("en");
  mocks.page.mockResolvedValueOnce({ items: [], hasMore: false, nextCursor: null });
  const empty = renderToStaticMarkup(await ReactionsPage({}));
  expect(empty).toContain(copy.empty);
  expect(empty).toContain(copy.emptyDescription);
  mocks.page.mockResolvedValueOnce({ items: [], hasMore: false, nextCursor: null });
  const filtered = renderToStaticMarkup(
    await ReactionsPage({ searchParams: Promise.resolve({ q: "Lua" }) }),
  );
  expect(filtered).toContain(copy.emptyFiltered);
  expect(filtered).toContain(copy.emptyFilteredDescription);
  expect(filtered).toContain(copy.reset);
});
it("clips honest reactions loading shells on narrow layouts", async () => {
  const html = renderToStaticMarkup(await ReactionsLoading());
  expect(html).toContain("min-w-0");
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain(reactionCopy("en").loading);
});
it("keeps reaction removal controls at a usable touch target", async () => {
  const html = renderToStaticMarkup(await ReactionsPage({}));
  expect(html).toContain("min-h-11");
  expect(html).toContain(reactionCopy("en").remove);
});
it.each(["en", "ru"] as const)(
  "explains current trust scope, hidden activity and absent recorded dates in %s",
  async (locale) => {
    mocks.locale = locale;
    const html = renderToStaticMarkup(<PublicUserTrustPanel data={trustData} locale={locale} />),
      copy = trustCopy(locale);
    expect(html).toContain(copy.title);
    expect(html).toContain(copy.hiddenActivity);
    expect(html).toContain(copy.noDate);
    expect(html).toContain(copy.notVerified);
    expect(html).not.toContain('href="/users/writer/activity"');
    expect(html).not.toContain("100");
    expect(html).toContain('href="/users/writer"');
    expect(await trustMetadata({ params: Promise.resolve({ username: "writer" }) })).toMatchObject({
      alternates: { canonical: "/users/writer/trust" },
    });
  },
);
it("shows public activity only when it is visible and zero is an actual count", () => {
  const html = renderToStaticMarkup(
    <PublicUserTrustPanel data={{ ...trustData, publications: 0 }} locale="en" />,
  );
  expect(html).toContain('href="/users/writer/activity"');
  expect(html).not.toContain(trustCopy("en").hiddenActivity);
});
it("offers safe trust recovery on infrastructure failure and 404 on a missing profile", async () => {
  const input = { params: Promise.resolve({ username: "writer" }) };
  mocks.trust.mockRejectedValueOnce(new Error("secret SQL"));
  const html = renderToStaticMarkup(await TrustPage(input));
  expect(html).toContain(trustCopy("en").unavailable);
  expect(html).toContain('role="alert"');
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain("min-w-0");
  expect(html).toContain("min-h-11");
  expect(html).toContain(getDictionary("en").errors.retry);
  expect(html).toContain('href="/users/writer/trust"');
  expect(html).not.toContain("secret SQL");
  mocks.trust.mockRejectedValueOnce(new AppError("missing", 404, "NOT_FOUND"));
  await expect(TrustPage(input)).rejects.toThrow("NOT_FOUND");
});
it("clips public trust panels and loading shells on narrow layouts", async () => {
  const panel = renderToStaticMarkup(<PublicUserTrustPanel data={trustData} locale="en" />);
  expect(panel).toContain("overflow-x-clip");
  expect(panel).toContain("min-w-0");
  expect(panel).toContain("min-h-11");
  const { default: TrustLoading } = await import(
    "../../apps/web/src/app/users/[username]/trust/loading"
  );
  const loading = renderToStaticMarkup(await TrustLoading());
  expect(loading).toContain("overflow-x-clip");
  expect(loading).toContain("min-w-0");
  expect(loading).toContain(trustCopy("en").loading);
});
