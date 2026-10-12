import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  locale: "en" as "en" | "ru",
  session: vi.fn(),
  profile: vi.fn(),
  organization: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => mock.locale }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: mock.session },
}));
vi.mock("../apps/web/src/lib/services/profile-change-history-service", () => ({
  profileChangeHistoryService: { page: mock.profile },
}));
vi.mock("../apps/web/src/lib/services/organization-governance-service", () => ({
  organizationGovernanceService: { history: mock.organization },
}));

import ProfilePage, { generateMetadata } from "../apps/web/src/app/settings/history/page";
import OrganizationPage from "../apps/web/src/app/workspace/organizations/[id]/activity/page";
import { OrganizationHistoryView } from "../apps/web/src/components/organization-history";
import { ProfileChangeHistoryView } from "../apps/web/src/components/profile-change-history";
import { privateChangeHistoryCopy } from "../apps/web/src/lib/private-change-history-copy";
import { encodeChangeHistoryCursor } from "../apps/web/src/lib/private-change-history-query";
import type { ProfileChangeHistory } from "../apps/web/src/lib/profile-change-history-contract";

const stamp = "2026-10-12T00:00:00.123456Z",
  cursor = encodeChangeHistoryCursor({
    version: 1,
    context: "a".repeat(64),
    id: "audit",
    until: stamp,
  });
const data: ProfileChangeHistory = {
  username: "owner",
  period: "30",
  group: "professional",
  until: stamp,
  items: [
    {
      id: "audit",
      action: "developer.profile_updated",
      createdAt: stamp,
      fields: ["specialties", "discordTag"],
      experienceVerificationInvalidated: true,
      actor: "you",
    },
  ],
  hasMore: true,
  nextCursor: cursor,
};
const org = {
  organization: { id: "org", name: "<script>Team</script>", slug: "team" },
  period: "7" as const,
  group: "team" as const,
  query: "Owner",
  until: stamp,
  items: [],
  hasMore: true,
  nextCursor: cursor,
};
beforeEach(() => {
  vi.resetAllMocks();
  mock.locale = "en";
  mock.session.mockResolvedValue({ id: "owner", role: "user" });
  mock.profile.mockResolvedValue(data);
  mock.organization.mockResolvedValue(org);
});
it.each(["en", "ru"] as const)(
  "renders accessible profile filters, recorded fields, verification context and stable export in %s",
  (locale) => {
    const html = renderToStaticMarkup(
      <ProfileChangeHistoryView
        data={data}
        filters={{ period: "30", group: "professional", query: "" }}
        locale={locale}
      />,
    );
    const copy = privateChangeHistoryCopy(locale);
    expect(html).toContain(copy.profileTitle);
    expect(html).toContain(copy.fieldNames.specialties);
    expect(html).toContain(copy.invalidated);
    expect(html).toContain('href="/workspace/verification"');
    expect(html).toContain('name="period"');
    expect(html).toContain('name="group"');
    expect(html).not.toContain('name="q"');
    expect(html).toContain(
      'href="/api/account/profile/history/export?period=30&amp;group=professional&amp;until=2026-10-12T00%3A00%3A00.123456Z"',
    );
    expect(html).toContain(`group=professional&amp;cursor=${cursor}`);
    expect(html).toMatch(/datetime="2026-10-12T00:00:00\.123456Z"/iu);
  },
);
it.each(["en", "ru"] as const)(
  "renders safe organization account search and filtered navigation/export in %s",
  (locale) => {
    const html = renderToStaticMarkup(
      <OrganizationHistoryView
        data={org}
        id="org"
        filters={{ period: "7", group: "team", query: "Owner" }}
        locale={locale}
      />,
    );
    const copy = privateChangeHistoryCopy(locale);
    expect(html).toContain('name="q"');
    expect(html).toContain('maxLength="80"');
    expect(html).toContain(copy.searchHelp);
    expect(html).toContain(copy.empty);
    expect(html).toContain(
      'href="/api/workspace/organizations/org/activity/export?period=7&amp;group=team&amp;q=Owner&amp;until=2026-10-12T00%3A00%3A00.123456Z"',
    );
    expect(html).toContain(`period=7&amp;group=team&amp;q=Owner&amp;cursor=${cursor}`);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  },
);
it("requires sign in before loading either private journal", async () => {
  mock.session.mockResolvedValue(null);
  expect(renderToStaticMarkup(await ProfilePage({}))).toContain('href="/auth/login"');
  expect(
    renderToStaticMarkup(await OrganizationPage({ params: Promise.resolve({ id: "org" }) })),
  ).toContain('href="/auth/login"');
  expect(mock.profile).not.toHaveBeenCalled();
  expect(mock.organization).not.toHaveBeenCalled();
});
it("passes only the session ID and normalized profile selectors into storage and hides private metadata from indexing", async () => {
  await ProfilePage({ searchParams: Promise.resolve({ period: "30", group: "professional" }) });
  expect(mock.profile).toHaveBeenCalledExactlyOnceWith(
    "owner",
    expect.objectContaining({ period: "30", group: "professional", query: "" }),
  );
  expect((await generateMetadata()).robots).toEqual({ index: false, follow: false });
});
it.each([{ actorId: "foreign" }, { period: ["7", "30"] }, { q: "private" }, { cursor: "bad" }])(
  "does not read profile history for invalid selectors %j",
  async (query) => {
    const html = renderToStaticMarkup(await ProfilePage({ searchParams: Promise.resolve(query) }));
    expect(html).toContain('role="alert"');
    expect(html).toContain(privateChangeHistoryCopy("en").invalid);
    expect(mock.profile).not.toHaveBeenCalled();
  },
);
it("preserves normalized organization selectors and renders a read failure distinctly", async () => {
  await OrganizationPage({
    params: Promise.resolve({ id: "org" }),
    searchParams: Promise.resolve({ period: "7", group: "team", q: " Owner " }),
  });
  expect(mock.organization).toHaveBeenCalledExactlyOnceWith(
    "org",
    { id: "owner", role: "user" },
    undefined,
    expect.objectContaining({ period: "7", group: "team", query: "Owner" }),
  );
  mock.profile.mockRejectedValue(Error("database-private-contact"));
  const html = renderToStaticMarkup(await ProfilePage({}));
  expect(html).toContain('role="alert"');
  expect(html).not.toContain("database-private");
  expect(html).not.toContain(privateChangeHistoryCopy("en").empty);
});
