import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  overview: vi.fn(),
  targets: vi.fn(),
  ownProfile: vi.fn(),
  locale: "en" as "en" | "ru",
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => mocks.locale }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: mocks.session },
}));
vi.mock("../apps/web/src/lib/services/verification-workspace-service", () => ({
  verificationWorkspaceService: mocks,
}));
import { VerificationWorkspace } from "../apps/web/src/components/verification-workspace";
import { DeveloperProfileEditor } from "../apps/web/src/components/developer-profile-editor";
import { DeveloperExperience } from "../apps/web/src/components/developer-experience";
import VerificationPage, {
  generateMetadata,
} from "../apps/web/src/app/workspace/verification/page";
import DeveloperSettingsPage from "../apps/web/src/app/settings/developer/page";
import { verificationCopy } from "../apps/web/src/lib/verification-workspace-copy";
import type { VerificationOverview } from "../apps/web/src/lib/verification-workspace-contract";
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
it("shows errors without presenting a failed read as empty history or editable default data", () => {
  const html = renderToStaticMarkup(
    <VerificationWorkspace
      initial={null}
      initialTeams={null}
      filters={filters}
      teamFilters={filters}
      locale="en"
    />,
  );
  expect(html).toContain('role="alert"');
  expect(html).not.toContain(verificationCopy("en").noApplications);
  const editor = renderToStaticMarkup(<DeveloperProfileEditor initial={null} locale="en" />);
  expect(editor).toContain('role="alert"');
  expect(editor).toContain("disabled");
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
  expect(renderToStaticMarkup(await VerificationPage())).toContain('href="/auth/login"');
  expect(renderToStaticMarkup(await DeveloperSettingsPage())).toContain('href="/auth/login"');
  expect(mocks.overview).not.toHaveBeenCalled();
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
