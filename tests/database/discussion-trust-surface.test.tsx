import { AppError } from "@nexus/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { OwnDiscussionDetail } from "../../apps/web/src/components/own-discussion-detail";
import { getDiscussionCopy } from "../../apps/web/src/lib/content-discussion-copy";
import { ownDiscussionCopy } from "../../apps/web/src/lib/discussion-workspace-copy";
import { approvalCopy } from "../../apps/web/src/lib/public-verification-history-copy";

const mocks = vi.hoisted(() => ({
  locale: "en" as "en" | "ru",
  session: vi.fn(),
  page: vi.fn(),
  own: vi.fn(),
  approvals: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "token" }) }) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  usePathname: () => "/workspace/discussions",
}));
vi.mock("../../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: mocks.session },
}));
vi.mock("../../apps/web/src/lib/services/discussion-workspace-service", () => ({
  discussionWorkspaceService: { page: mocks.page, own: mocks.own },
}));
vi.mock("../../apps/web/src/lib/services/public-verification-history-service", () => ({
  publicVerificationHistoryService: { page: mocks.approvals },
}));
vi.mock("../../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => mocks.locale }));

import UserTrustHistoryLoading from "../../apps/web/src/app/users/[username]/trust/history/loading";
import HistoryPage, {
  generateMetadata as historyMetadata,
} from "../../apps/web/src/app/users/[username]/trust/history/page";
import DetailPage from "../../apps/web/src/app/workspace/discussions/[id]/page";
import DiscussionsLoading from "../../apps/web/src/app/workspace/discussions/loading";
import OwnPage, { generateMetadata } from "../../apps/web/src/app/workspace/discussions/page";
import { getDictionary } from "../../apps/web/src/lib/i18n";

const item = {
    id: "comment",
    contentId: "content",
    text: "My own text",
    createdAt: "2026-10-11T00:00:00.000Z",
    title: null,
    slug: null,
    type: null,
    revision: "a".repeat(64),
    available: false,
    editable: false,
  },
  profile = { params: Promise.resolve({ username: "writer" }) },
  detail = { params: Promise.resolve({ id: "comment" }) };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.locale = "en";
  mocks.session.mockResolvedValue({ id: "actor" });
  mocks.page.mockResolvedValue({ items: [item], hasMore: true, nextCursor: "next" });
  mocks.own.mockResolvedValue(item);
  mocks.approvals.mockResolvedValue({
    subject: {
      username: "writer",
      name: "Writer",
      identityVerified: false,
      developerVerified: false,
    },
    items: [{ key: "b".repeat(32), type: "user", approvedAt: "2026-01-01T00:00:00.000Z" }],
    hasMore: true,
    nextCursor: "next",
  });
});
it.each(["en", "ru"] as const)(
  "renders private filters, bounded summaries, management and continuation in %s",
  async (locale) => {
    mocks.locale = locale;
    const copy = ownDiscussionCopy(locale);
    const html = renderToStaticMarkup(
      await OwnPage({ searchParams: Promise.resolve({ q: "Lua", availability: "unavailable" }) }),
    );
    expect(html).toContain(copy.hidden);
    expect(html).toContain(copy.privacy);
    expect(html).toContain(item.text);
    expect(html).toContain(`<search aria-label="${copy.filters}"`);
    expect(html).toContain('name="q"');
    expect(html).toContain('name="availability"');
    expect(html).toContain('href="/workspace/discussions/comment"');
    expect(html).toContain("cursor=next");
    expect(html).not.toContain('href="/articles/');
    expect(await generateMetadata()).toMatchObject({
      title: copy.title,
      robots: { index: false, follow: false },
    });
  },
);
it.each(["en", "ru"] as const)(
  "permits own archived removal, with no edit or unavailable-publication link in %s",
  (locale) => {
    const html = renderToStaticMarkup(<OwnDiscussionDetail initial={item} locale={locale} />),
      copy = ownDiscussionCopy(locale),
      actions = getDiscussionCopy(locale);
    expect(html).toContain(copy.hiddenNote);
    expect(html).toContain('id="own-discussion-publication-unavailable"');
    expect(html).toContain('role="alert"');
    expect(html).toContain(copy.readOnly);
    expect(html).toContain('id="own-discussion-readonly"');
    expect(html).toContain(actions.remove);
    expect(html).not.toContain(`>${actions.edit}</button>`);
    expect(html).not.toContain('href="/articles/');
    expect(html).not.toContain('disabled=""');
  },
);
it("shows edit and exact discussion permalink for an available own comment", () => {
  const html = renderToStaticMarkup(
    <OwnDiscussionDetail
      initial={{ ...item, title: "Guide", slug: "guide", available: true, editable: true }}
      locale="en"
    />,
  );
  expect(html).toContain(getDiscussionCopy("en").edit);
  expect(html).toContain('href="/articles/guide?comment=comment#comment-comment"');
});
it("keeps infrastructure failures distinct from missing sessions on list and detail", async () => {
  mocks.session.mockRejectedValue(new Error("secret session SQL"));
  expect(renderToStaticMarkup(await OwnPage({}))).toContain(
    'href="/auth/login?next=%2Fworkspace%2Fdiscussions"',
  );
  expect(renderToStaticMarkup(await DetailPage(detail))).toContain(
    'href="/auth/login?next=%2Fworkspace%2Fdiscussions%2Fcomment"',
  );
  for (const html of [
    renderToStaticMarkup(await OwnPage({})),
    renderToStaticMarkup(await DetailPage(detail)),
  ]) {
    expect(html).not.toContain("secret session");
    expect(html).not.toContain(ownDiscussionCopy("en").title);
  }
  expect(mocks.page).not.toHaveBeenCalled();
  expect(mocks.own).not.toHaveBeenCalled();
});
it("does not load private data for guests", async () => {
  mocks.session.mockResolvedValue(null);
  expect(renderToStaticMarkup(await OwnPage({}))).toContain(
    'href="/auth/login?next=%2Fworkspace%2Fdiscussions"',
  );
  expect(renderToStaticMarkup(await DetailPage(detail))).toContain(
    'href="/auth/login?next=%2Fworkspace%2Fdiscussions%2Fcomment"',
  );
  expect(mocks.page).not.toHaveBeenCalled();
  expect(mocks.own).not.toHaveBeenCalled();
});
it("rejects duplicate/unknown private filters before service and restores fresh navigation", async () => {
  const html = renderToStaticMarkup(
    await OwnPage({ searchParams: Promise.resolve({ q: ["a", "b"], actorId: "other" }) }),
  );
  expect(html).toContain(ownDiscussionCopy("en").invalid);
  expect(html).toContain('href="/workspace/discussions"');
  expect(mocks.page).not.toHaveBeenCalled();
});
it("provides 404 for missing or foreign own comments and reload for persistence failure", async () => {
  mocks.own.mockRejectedValueOnce(new AppError("Foreign", 404, "NOT_FOUND"));
  await expect(DetailPage(detail)).rejects.toThrow("NOT_FOUND");
  mocks.own.mockRejectedValueOnce(new Error("secret text"));
  const html = renderToStaticMarkup(await DetailPage(detail));
  expect(html).toContain(ownDiscussionCopy("en").failed);
  expect(html).toContain('role="alert"');
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain(getDictionary("en").errors.retry);
  expect(html).toContain('href="/workspace/discussions/comment"');
  expect(html).not.toContain("secret text");
});
it("shows an honest recovery state when own comments fail to load", async () => {
  mocks.page.mockRejectedValueOnce(new Error("comments unavailable"));
  const copy = ownDiscussionCopy("en");
  const html = renderToStaticMarkup(await OwnPage({}));
  expect(html).toContain('role="alert"');
  expect(html).toContain(copy.failed);
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain(getDictionary("en").errors.retry);
  expect(html).toContain('href="/workspace/discussions"');
  expect(html).not.toContain("comments unavailable");
});
it("shows EmptyState descriptions for empty and filtered own comments", async () => {
  const copy = ownDiscussionCopy("en");
  mocks.page.mockResolvedValueOnce({ items: [], hasMore: false, nextCursor: null });
  const empty = renderToStaticMarkup(await OwnPage({}));
  expect(empty).toContain(copy.empty);
  expect(empty).toContain(copy.emptyDescription);
  mocks.page.mockResolvedValueOnce({ items: [], hasMore: false, nextCursor: null });
  const filtered = renderToStaticMarkup(
    await OwnPage({ searchParams: Promise.resolve({ q: "Lua" }) }),
  );
  expect(filtered).toContain(copy.emptyFiltered);
  expect(filtered).toContain(copy.emptyFilteredDescription);
  expect(filtered).toContain(copy.reset);
});
it("clips honest discussions loading shells on narrow layouts", async () => {
  const html = renderToStaticMarkup(await DiscussionsLoading());
  expect(html).toContain("min-w-0");
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain(ownDiscussionCopy("en").loading);
});
it.each(["en", "ru"] as const)(
  "separates historical approvals from currently unverified flags in %s",
  async (locale) => {
    mocks.locale = locale;
    const copy = approvalCopy(locale),
      html = renderToStaticMarkup(
        await HistoryPage({ ...profile, searchParams: Promise.resolve({ type: "user" }) }),
      );
    expect(html).toContain(copy.current);
    expect(html).toContain(copy.unverified);
    expect(html).toContain(copy.approved);
    expect(html).toContain(copy.scope);
    expect(html).toContain('dateTime="2026-01-01T00:00:00.000Z"');
    expect(html).toContain('name="type"');
    expect(html).toContain("type=user&amp;cursor=next");
    expect(mocks.session).not.toHaveBeenCalled();
    expect(await historyMetadata(profile)).toMatchObject({
      title: copy.title,
      alternates: { canonical: "/users/writer/trust/history" },
    });
  },
);
it("does not interpret empty history or failed reads as verification decisions", async () => {
  mocks.approvals.mockResolvedValueOnce({
    subject: {
      username: "writer",
      name: "Writer",
      identityVerified: true,
      developerVerified: false,
    },
    items: [],
    hasMore: false,
    nextCursor: null,
  });
  const copy = approvalCopy("en"),
    subject = {
      username: "writer",
      name: "Writer",
      identityVerified: true,
      developerVerified: false,
    },
    empty = renderToStaticMarkup(await HistoryPage(profile));
  expect(empty).toContain(copy.empty);
  expect(empty).toContain(copy.emptyHint);
  expect(empty).not.toContain(copy.emptyFiltered);
  expect(empty).toContain(copy.verified);
  expect(empty).toContain("overflow-x-clip");
  expect(empty).toContain("min-w-0");
  expect(empty).toContain("min-h-11");
  mocks.approvals.mockResolvedValueOnce({
    subject,
    items: [],
    hasMore: false,
    nextCursor: null,
  });
  const filtered = renderToStaticMarkup(
    await HistoryPage({ ...profile, searchParams: Promise.resolve({ type: "developer" }) }),
  );
  expect(filtered).toContain(copy.emptyFiltered);
  expect(filtered).toContain(copy.emptyFilteredHint);
  expect(filtered).toContain(copy.reset);
  expect(filtered).toContain("/users/writer/trust/history");
  mocks.approvals.mockRejectedValueOnce(new Error("secret proof"));
  const failed = renderToStaticMarkup(await HistoryPage(profile));
  expect(failed).toContain(approvalCopy("en").unavailable);
  expect(failed).toContain('role="alert"');
  expect(failed).toContain(getDictionary("en").errors.retry);
  expect(failed).toContain("overflow-x-clip");
  expect(failed).toContain("min-h-11");
  expect(failed).not.toContain(approvalCopy("en").empty);
  expect(failed).not.toContain(approvalCopy("en").emptyHint);
  expect(failed).not.toContain("secret proof");
});
it("rejects public proof filters and returns missing profile 404", async () => {
  const html = renderToStaticMarkup(
    await HistoryPage({ ...profile, searchParams: Promise.resolve({ includeProof: "true" }) }),
  );
  expect(html).toContain(approvalCopy("en").invalid);
  expect(html).toContain('role="alert"');
  expect(html).toContain(getDictionary("en").errors.retry);
  expect(html).toContain("min-h-11");
  expect(html).toContain('href="/users/writer/trust/history"');
  expect(mocks.approvals).not.toHaveBeenCalled();
  mocks.approvals.mockRejectedValue(new AppError("missing", 404, "NOT_FOUND"));
  await expect(HistoryPage(profile)).rejects.toThrow("NOT_FOUND");
});
it("clips user trust history loading shells on narrow layouts", async () => {
  const html = renderToStaticMarkup(await UserTrustHistoryLoading());
  expect(html).toContain("min-w-0");
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain(approvalCopy("en").loading);
});
