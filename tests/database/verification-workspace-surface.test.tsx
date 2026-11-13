import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  overview: vi.fn(),
  targets: vi.fn(),
  ownProfile: vi.fn(),
  locale: "en" as "en" | "ru",
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/workspace/verification",
}));
vi.mock("../../site/src/lib/i18n-server", () => ({
  getRequestLocale: async () => mocks.locale,
}));
vi.mock("../../site/src/lib/services/auth-service", () => ({
  authService: { getSession: mocks.session },
}));
vi.mock("../../site/src/lib/services/verification-workspace-service", () => ({
  verificationWorkspaceService: mocks,
}));

import DeveloperSettingsPage from "../../site/src/app/settings/developer/page";
import VerificationPage, { generateMetadata } from "../../site/src/app/workspace/verification/page";
import { DeveloperExperience } from "../../site/src/components/developer-experience";
import { DeveloperProfileEditor } from "../../site/src/components/developer-profile-editor";
import { VerificationWorkspace } from "../../site/src/components/verification-workspace";
import type { VerificationOverview } from "../../site/src/lib/verification-workspace-contract";
import { verificationCopy } from "../../site/src/lib/verification-workspace-copy";

const filters = { page: 2, view: "history" as const, type: "developer", query: "" };
const overview: VerificationOverview = {
  profile: {
    id: "actor",
    username: "dev",
    name: "Dev",
    role: "developer",
    identityVerified: true,
    experienceVerified: false,
    hasSpecialties: true,
    identityPending: false,
    experiencePending: false,
  },
  history: {
    items: [
      {
        id: "request",
        targetType: "developer",
        targetId: "actor",
        status: "rejected",
        notes: "<script>proof</script>",
        proofUrl: "javascript:alert(1)",
        reviewNotes: "<img src=x>",
        createdAt: "2026-10-10T00:00:00.000Z",
        resolvedAt: "2026-10-10T00:00:00.000Z",
      },
    ],
    page: 2,
    view: "history",
    hasMore: true,
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.locale = "en";
  mocks.session.mockResolvedValue({ id: "actor", role: "developer" });
  mocks.overview.mockResolvedValue(overview);
  mocks.targets.mockResolvedValue({ items: [], page: 1, hasMore: false });
});
it.each(["ru", "en"] as const)(
  "renders escaped private feedback, distinct identity/experience and bounded navigation in %s",
  (locale) => {
    const html = renderToStaticMarkup(
      <VerificationWorkspace
        actorId="actor"
        initial={overview}
        initialTeams={{
          items: [{ id: "org", name: "Team", slug: "team", verified: false, pending: true }],
          page: 1,
          hasMore: false,
        }}
        filters={filters}
        teamFilters={{ ...filters, page: 1, query: "Team" }}
        locale={locale}
      />,
    );
    expect(html).toContain(verificationCopy(locale).developer);
    expect(html).toContain(verificationCopy(locale).identityHint);
    expect(html).toContain(verificationCopy(locale).teamPending);
    expect(html).toContain("page=3");
    expect(html).toContain("type=developer");
    expect(html).toContain('href="/settings/developer"');
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<script>");
  },
);
it("offers clear organization search when managed teams are empty", () => {
  const copy = verificationCopy("en");
  const html = renderToStaticMarkup(
    <VerificationWorkspace
      actorId="actor"
      initial={overview}
      initialTeams={{ items: [], page: 1, hasMore: false }}
      filters={filters}
      teamFilters={{ page: 1, view: "history", type: undefined, query: "missing" }}
      locale="en"
    />,
  );
  expect(html).toContain(copy.noTeams);
  expect(html).toContain(copy.noTeamsHint);
  expect(html).toContain(copy.clearTeamSearch);
  expect(html).toContain("teamsQ=");
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain("min-w-0");
});

it("offers a clear filter or alternate view when history is empty", () => {
  const copy = verificationCopy("en");
  const emptyOverview: VerificationOverview = {
    ...overview,
    history: { ...overview.history, items: [], hasMore: false },
  };
  const filtered = renderToStaticMarkup(
    <VerificationWorkspace
      actorId="actor"
      initial={emptyOverview}
      initialTeams={{ items: [], page: 1, hasMore: false }}
      filters={filters}
      teamFilters={{ page: 1, view: "history", type: undefined, query: "" }}
      locale="en"
    />,
  );
  expect(filtered).toContain(copy.noApplications);
  expect(filtered).toContain(copy.noApplicationsFilteredHint);
  expect(filtered).toContain(copy.all);
  expect(filtered).toContain(
    'href="/workspace/verification?page=1&amp;view=history&amp;teamsPage=1&amp;teamsQ="',
  );
  const alternate = renderToStaticMarkup(
    <VerificationWorkspace
      actorId="actor"
      initial={emptyOverview}
      initialTeams={{ items: [], page: 1, hasMore: false }}
      filters={{ page: 1, view: "pending", type: undefined, query: "" }}
      teamFilters={{ page: 1, view: "pending", type: undefined, query: "" }}
      locale="en"
    />,
  );
  expect(alternate).toContain(copy.noApplicationsHint);
  expect(alternate).toContain(copy.history);
  expect(alternate).toContain("view=history");
});

it("shows errors without presenting a failed read as empty history or editable default data", () => {
  const copy = verificationCopy("en");
  const html = renderToStaticMarkup(
    <VerificationWorkspace
      actorId="actor"
      initial={null}
      initialTeams={null}
      filters={filters}
      teamFilters={filters}
      locale="en"
    />,
  );
  expect(html).toContain('role="alert"');
  expect(html).toContain('id="verification-workspace-unavailable"');
  expect(html).toContain(copy.unavailable);
  expect(html).toContain("min-h-11");
  expect(html).toContain("overflow-x-clip");
  expect(html).not.toContain(copy.noApplications);
  const editor = renderToStaticMarkup(
    <DeveloperProfileEditor actorId="actor" initial={null} locale="en" />,
  );
  expect(editor).toContain('role="alert"');
  expect(editor).toContain("disabled");
});
it("clips the verification centre loading shell on narrow layouts", async () => {
  const { default: VerificationLoading } = await import(
    "../../site/src/app/workspace/verification/loading"
  );
  const html = renderToStaticMarkup(await VerificationLoading());
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain("min-w-0");
  expect(html).toContain(verificationCopy("en").loading);
});
it("recovers with ErrorState when verification session probing fails", async () => {
  mocks.session.mockRejectedValueOnce(Error("PRIVATE_AUTH"));
  const html = renderToStaticMarkup(await VerificationPage({}));
  expect(html).toContain('role="alert"');
  expect(html).toContain('id="verification-workspace-unavailable"');
  expect(html).toContain(verificationCopy("en").unavailable);
  expect(html).toContain('href="/workspace/verification"');
  expect(html).toContain("overflow-x-clip");
  expect(html).not.toContain("PRIVATE_AUTH");
});
it("publishes a genuine experience badge only when that flag is verified; suppresses unsafe legacy contact links", () => {
  const profile = {
    specialties: ["Lua", "<script>"],
    githubUrl: "javascript:alert(1)",
    discordTag: "<script>contact",
    verifiedDeveloper: false,
  };
  const html = renderToStaticMarkup(<DeveloperExperience profile={profile} locale="en" />);
  expect(html).not.toContain(verificationCopy("en").experience);
  expect(html).not.toContain("javascript:");
  expect(html).toContain("&lt;script&gt;");
  expect(
    renderToStaticMarkup(
      <DeveloperExperience profile={{ ...profile, verifiedDeveloper: true }} locale="ru" />,
    ),
  ).toContain(verificationCopy("ru").experience);
});
it("does not load private account data for anonymous sessions or professional settings for unrelated roles", async () => {
  mocks.session.mockResolvedValue(null);
  const verificationGuest = renderToStaticMarkup(await VerificationPage({}));
  expect(verificationGuest).toContain('href="/auth/login?next=%2Fworkspace%2Fverification"');
  expect(verificationGuest).toContain('href="/auth/register?next=%2Fworkspace%2Fverification"');
  const developerGuest = renderToStaticMarkup(await DeveloperSettingsPage());
  expect(developerGuest).toContain('href="/auth/login?next=%2Fsettings%2Fdeveloper"');
  expect(developerGuest).toContain('href="/auth/register?next=%2Fsettings%2Fdeveloper"');
  expect(mocks.overview).not.toHaveBeenCalled();
  expect(
    renderToStaticMarkup(
      await VerificationPage({
        searchParams: Promise.resolve({
          page: "2",
          view: "history",
          type: "developer",
          teamsPage: "3",
          teamsQ: "Team",
        }),
      }),
    ),
  ).toContain(
    'href="/auth/login?next=%2Fworkspace%2Fverification%3Fpage%3D2%26view%3Dhistory%26type%3Ddeveloper%26teamsPage%3D3%26teamsQ%3DTeam"',
  );
  expect(
    renderToStaticMarkup(
      await VerificationPage({
        searchParams: Promise.resolve({
          page: "2",
          view: "history",
          type: "developer",
          teamsPage: "3",
          teamsQ: "Team",
        }),
      }),
    ),
  ).toContain(
    'href="/auth/register?next=%2Fworkspace%2Fverification%3Fpage%3D2%26view%3Dhistory%26type%3Ddeveloper%26teamsPage%3D3%26teamsQ%3DTeam"',
  );
  mocks.session.mockResolvedValue({ id: "actor", role: "user" });
  expect(renderToStaticMarkup(await DeveloperSettingsPage())).toContain(
    verificationCopy("en").roleRequired,
  );
  expect(mocks.ownProfile).not.toHaveBeenCalled();
});
it("binds SSR history/managed organization filters to the session and marks private metadata noindex", async () => {
  await VerificationPage({
    searchParams: Promise.resolve({
      page: "2",
      view: "history",
      type: "developer",
      teamsPage: "3",
      teamsQ: "Team",
    }),
  });
  expect(mocks.overview).toHaveBeenCalledWith({ id: "actor", role: "developer" }, filters);
  expect(mocks.targets).toHaveBeenCalledWith(
    { id: "actor", role: "developer" },
    expect.objectContaining({ page: 3, query: "Team" }),
  );
  expect((await generateMetadata()).robots.index).toBe(false);
});
