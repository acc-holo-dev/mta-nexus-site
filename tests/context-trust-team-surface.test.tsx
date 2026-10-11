import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { AppError } from "@nexus/domain";
import { contextTrustCopy } from "../apps/web/src/lib/public-context-trust-copy";
import { approvalCopy } from "../apps/web/src/lib/public-verification-history-copy";
import { organizationTeamCopy } from "../apps/web/src/lib/organization-team-copy";
import { getOrganizationCopy } from "../apps/web/src/lib/organization-workspace-copy";
import { OrganizationTeamDirectory } from "../apps/web/src/components/organization-team-directory";
const mocks = vi.hoisted(() => ({
  locale: "en" as "en" | "ru",
  session: vi.fn(),
  trust: vi.fn(),
  team: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "token" }) }) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => mocks.locale }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: mocks.session },
}));
vi.mock("../apps/web/src/lib/services/public-context-trust-service", () => ({
  publicContextTrustService: { page: mocks.trust },
}));
vi.mock("../apps/web/src/lib/services/organization-team-service", () => ({
  organizationTeamService: { page: mocks.team },
}));
import {
  PublicContextTrustPage,
  contextTrustMetadata,
} from "../apps/web/src/components/public-context-trust-page";
import TeamPage, {
  generateMetadata,
} from "../apps/web/src/app/workspace/organizations/[id]/team/page";
const time = "2026-10-11T00:00:00.000Z",
  context = { params: Promise.resolve({ slug: "team" }) },
  teamParams = { params: Promise.resolve({ id: "org" }) };
const identity = { id: "reader", username: "reader", displayName: "Reader", avatarUrl: null };
const data = {
  organization: {
    id: "org",
    slug: "team",
    name: "Team",
    ownerId: "owner",
    isVerified: false,
    updatedAt: time,
    description: "",
    logoUrl: "",
    websiteUrl: "",
  },
  role: "owner" as const,
  owner: { ...identity, id: "owner", username: "boss", displayName: "Boss" },
  members: [
    {
      ...identity,
      role: "admin",
      managesServers: false,
      effectiveServerAccess: true,
      joinedAt: time,
    },
  ],
  hasMore: true,
  nextCursor: "next",
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.locale = "en";
  mocks.session.mockResolvedValue({ id: "owner" });
  mocks.team.mockResolvedValue(data);
  mocks.trust.mockResolvedValue({
    subject: {
      kind: "organization",
      slug: "team",
      name: "Team",
      createdAt: time,
      verified: false,
      publications: 0,
      servers: { total: 2, verified: 1 },
      organization: null,
      ownershipKind: null,
    },
    items: [{ key: "b".repeat(32), approvedAt: time }],
    hasMore: true,
    nextCursor: "next",
  });
});
it.each(["en", "ru"] as const)(
  "shows current organization signals separately from old approvals with localized scope in %s",
  async (locale) => {
    mocks.locale = locale;
    const copy = contextTrustCopy(locale),
      html = renderToStaticMarkup(
        await PublicContextTrustPage({ ...context, kind: "organization" }),
      );
    expect(html).toContain(copy.title);
    expect(html).toContain(copy.unverified);
    expect(html).toContain(copy.approved);
    expect(html).toContain(copy.organizationScope);
    expect(html).toContain(approvalCopy(locale).scope);
    expect(html).toContain('href="/organizations/team/activity"');
    expect(html).toContain('href="/organizations/team/trust?cursor=next"');
    expect(html).toContain(copy.verifiedServers);
    expect(html).not.toContain("secret");
    expect(await contextTrustMetadata("organization", context)).toMatchObject({
      title: copy.title,
      alternates: { canonical: "/organizations/team/trust" },
    });
    expect(mocks.session).not.toHaveBeenCalled();
  },
);
it("shows a server's current organization and public activity without personal identity, endpoint or uptime claims", async () => {
  mocks.trust.mockResolvedValue({
    subject: {
      kind: "server",
      slug: "team",
      name: "Server",
      createdAt: time,
      verified: true,
      publications: 0,
      servers: null,
      organization: { slug: "org-team", name: "Current team", verified: false },
      ownershipKind: "organization",
    },
    items: [],
    hasMore: false,
    nextCursor: null,
  });
  const html = renderToStaticMarkup(await PublicContextTrustPage({ ...context, kind: "server" }));
  expect(html).toContain(contextTrustCopy("en").serverScope);
  expect(html).toContain('href="/organizations/org-team/trust"');
  expect(html).toContain('href="/servers/team/updates"');
  expect(html).toContain(contextTrustCopy("en").empty);
  expect(html).not.toContain(contextTrustCopy("en").verifiedServers);
});
it("rejects proof/identity query overrides before service and provides a fresh-state recovery", async () => {
  const html = renderToStaticMarkup(
    await PublicContextTrustPage({
      ...context,
      kind: "server",
      searchParams: Promise.resolve({ includeProof: "true" }),
    }),
  );
  expect(html).toContain(approvalCopy("en").invalid);
  expect(html).toContain('href="/servers/team/trust"');
  expect(mocks.trust).not.toHaveBeenCalled();
});
it("uses 404 for missing/nonpublic contexts and does not show empty records on failures", async () => {
  mocks.trust.mockRejectedValueOnce(new AppError("Hidden", 404, "NOT_FOUND"));
  await expect(PublicContextTrustPage({ ...context, kind: "server" })).rejects.toThrow("NOT_FOUND");
  mocks.trust.mockRejectedValueOnce(new Error("secret evidence"));
  const html = renderToStaticMarkup(
    await PublicContextTrustPage({ ...context, kind: "organization" }),
  );
  expect(html).toContain(contextTrustCopy("en").unavailable);
  expect(html).not.toContain(contextTrustCopy("en").empty);
  expect(html).not.toContain("secret evidence");
});
it.each(["en", "ru"] as const)(
  "renders filters, effective access, current owner and existing member operations in %s",
  async (locale) => {
    mocks.locale = locale;
    const copy = organizationTeamCopy(locale),
      team = getOrganizationCopy(locale);
    const html = renderToStaticMarkup(
      await TeamPage({
        ...teamParams,
        searchParams: Promise.resolve({ q: "reader", role: "admin", access: "yes" }),
      }),
    );
    expect(html).toContain(copy.title);
    expect(html).toContain(copy.private);
    expect(html).toContain(copy.ownerNote);
    expect(html).toContain(copy.yes);
    expect(html).toContain('name="role"');
    expect(html).toContain('name="access"');
    expect(html).toContain('name="q"');
    expect(html).toContain("role=admin&amp;access=yes&amp;cursor=next");
    expect(html).toContain(team.updateMember);
    expect(html).toContain(team.remove);
    expect(html).toContain('href="/workspace/organizations/org?q=reader"');
    expect(await generateMetadata()).toMatchObject({
      title: copy.title,
      robots: { index: false, follow: false },
    });
  },
);
it("keeps administrators from changing themselves/other admins and ordinary members read-only", () => {
  for (const role of ["admin", "member"] as const) {
    const html = renderToStaticMarkup(
      <OrganizationTeamDirectory
        initial={{ ...data, role }}
        filters={{ query: "" }}
        actorId="reader"
        locale="en"
      />,
    );
    expect(html).not.toContain(getOrganizationCopy("en").updateMember);
    expect(html).not.toContain(getOrganizationCopy("en").removeConfirm);
    expect(html).not.toContain(organizationTeamCopy("en").transfer);
  }
});
it("labels legacy owner entries without implying actual ownership", () => {
  const html = renderToStaticMarkup(
    <OrganizationTeamDirectory
      initial={{
        ...data,
        members: [{ ...data.members[0], role: "owner", effectiveServerAccess: false }],
      }}
      filters={{ query: "" }}
      actorId="owner"
      locale="ru"
    />,
  );
  expect(html).toContain(organizationTeamCopy("ru").legacyOwner);
  expect(html).not.toContain(getOrganizationCopy("ru").updateMember);
  expect(html).toContain("Boss");
});
it("does not load private team data for guests and separates session failures from login", async () => {
  mocks.session.mockResolvedValueOnce(null);
  expect(renderToStaticMarkup(await TeamPage(teamParams))).toContain('href="/auth/login"');
  expect(mocks.team).not.toHaveBeenCalled();
  mocks.session.mockRejectedValueOnce(new Error("private session"));
  const failed = renderToStaticMarkup(await TeamPage(teamParams));
  expect(failed).toContain('role="alert"');
  expect(failed).not.toContain('href="/auth/login"');
  expect(failed).not.toContain("private session");
});
it.each(["constructor", "toString", "__proto__"])(
  "renders unsupported legacy role %s as text without granting controls",
  (role) => {
    const html = renderToStaticMarkup(
      <OrganizationTeamDirectory
        initial={{
          ...data,
          role: "member",
          members: [{ ...data.members[0], role, effectiveServerAccess: false }],
        }}
        filters={{ query: "" }}
        actorId="owner"
        locale="en"
      />,
    );
    expect(html).toContain(role);
    expect(html).not.toContain(getOrganizationCopy("en").updateMember);
    expect(html).not.toContain(organizationTeamCopy("en").transfer);
  },
);
it("rejects duplicate or private SSR filters and masks authority failures", async () => {
  const bad = renderToStaticMarkup(
    await TeamPage({ ...teamParams, searchParams: Promise.resolve({ role: ["admin", "member"] }) }),
  );
  expect(bad).toContain(organizationTeamCopy("en").invalid);
  expect(mocks.team).not.toHaveBeenCalled();
  mocks.team.mockRejectedValue(new AppError("Private team names", 403, "FORBIDDEN"));
  const denied = renderToStaticMarkup(await TeamPage(teamParams));
  expect(denied).toContain('role="alert"');
  expect(denied).not.toContain("Boss");
  expect(denied).not.toContain("Private team names");
});
