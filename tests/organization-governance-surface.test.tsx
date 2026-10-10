import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  history: vi.fn(),
  locale: "en" as "en" | "ru",
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => mocks.locale }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: mocks.session },
}));
vi.mock("../apps/web/src/lib/services/organization-governance-service", () => ({
  organizationGovernanceService: mocks,
}));

import HistoryPage, {
  generateMetadata,
} from "../apps/web/src/app/workspace/organizations/[id]/activity/page";
import { OrganizationHistoryView } from "../apps/web/src/components/organization-history";
import { OrganizationOwnershipTransfer } from "../apps/web/src/components/organization-ownership-transfer";
import { OrganizationWorkspacePanel } from "../apps/web/src/components/organization-workspace";
import {
  confirmOwnershipTransfer,
  type OrganizationHistory,
  ownershipTransferSchema,
} from "../apps/web/src/lib/organization-governance-contract";
import { organizationGovernanceCopy } from "../apps/web/src/lib/organization-governance-copy";
import type { OrganizationWorkspace } from "../apps/web/src/lib/organization-workspace-contract";

const time = "2026-10-11T00:00:00.000Z",
  later = "2026-10-11T00:00:01.000Z";
const organization = {
  id: "org",
  name: "Team",
  slug: "team",
  ownerId: "owner",
  description: "",
  logoUrl: "",
  websiteUrl: "",
  isVerified: false,
  updatedAt: time,
};
const member = {
  id: "target",
  username: "target",
  displayName: "<script>Target</script>",
  avatarUrl: null,
  role: "developer",
  managesServers: true,
  joinedAt: time,
};
const workspace: OrganizationWorkspace = {
  organization,
  role: "owner",
  owner: { id: "owner", username: "owner", displayName: "Owner", avatarUrl: null },
  members: [member],
  page: 2,
  hasMore: true,
};
const data: OrganizationHistory = {
  organization: { id: "org", name: "Team", slug: "team" },
  items: [
    {
      id: "audit",
      action: "organization.member_updated",
      createdAt: time,
      actorUsername: "owner",
      actorName: "<script>Owner</script>",
      subjectUsername: "target",
      subjectName: "<img src=x>",
      fromRole: "member",
      toRole: "developer",
      managesServers: true,
      fields: ["name"],
    },
  ],
  hasMore: true,
  nextCursor: "audit",
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.locale = "en";
  mocks.session.mockResolvedValue({ id: "owner", role: "user" });
  mocks.history.mockResolvedValue(data);
});
it.each(["ru", "en"] as const)(
  "renders owner-only explicit confirmation, eligible team selection and private history navigation in %s",
  (locale) => {
    const copy = organizationGovernanceCopy(locale),
      handlers = { onBusyChange: vi.fn(), onCancel: vi.fn(), onSaved: vi.fn(), onReload: vi.fn() };
    const html = renderToStaticMarkup(
      <OrganizationOwnershipTransfer
        data={workspace}
        target={member}
        actorId="owner"
        locale={locale}
        busy={false}
        {...handlers}
      />,
    );
    expect(html).toContain(copy.confirmation.replaceAll("'", "&#x27;"));
    expect(html).toContain(copy.consequence);
    expect(html).toContain("&lt;script&gt;");
    expect(html).toMatch(/autocomplete="off"/iu);
    expect(html).toContain("disabled");
    expect(html).not.toContain('value="owner"');
    const panel = renderToStaticMarkup(
      <OrganizationWorkspacePanel initial={workspace} locale={locale} actorId="owner" query="" />,
    );
    expect(panel).toContain(copy.choose);
    expect(panel).toContain('href="/workspace/organizations/org/activity"');
    const admin = renderToStaticMarkup(
      <OrganizationWorkspacePanel
        initial={{ ...workspace, role: "admin" }}
        locale={locale}
        actorId="target"
        query=""
      />,
    );
    expect(admin).not.toContain(copy.submit);
    expect(admin).not.toContain(copy.choose);
    const regular = renderToStaticMarkup(
      <OrganizationWorkspacePanel
        initial={{ ...workspace, role: "member" }}
        locale={locale}
        actorId="target"
        query=""
      />,
    );
    expect(regular).not.toContain('href="/workspace/organizations/org/activity"');
  },
);
it("hides ownership controls when a stale role claims ownership but the actual owner differs", () => {
  expect(
    renderToStaticMarkup(
      <OrganizationOwnershipTransfer
        data={workspace}
        target={member}
        actorId="other"
        locale="en"
        busy={false}
        onBusyChange={vi.fn()}
        onCancel={vi.fn()}
        onSaved={vi.fn()}
        onReload={vi.fn()}
      />,
    ),
  ).toBe("");
});
it.each(["ru", "en"] as const)(
  "renders escaped audit identities, allowlisted field labels and real cursor links in %s",
  (locale) => {
    const html = renderToStaticMarkup(
      <OrganizationHistoryView data={data} id="org" before="previous" locale={locale} />,
    );
    expect(html).toContain(
      organizationGovernanceCopy(locale).actions["organization.member_updated"],
    );
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<script>");
    expect(html).toContain("/users/target");
    expect(html).toContain("before=audit");
    expect(html).toContain("UTC");
    const failed = renderToStaticMarkup(
      <OrganizationHistoryView data={null} id="org" locale={locale} />,
    );
    expect(failed).toContain('role="alert"');
    expect(failed).not.toContain(organizationGovernanceCopy(locale).empty);
  },
);
it("requires exact recipient/organization/role/newer revision before accepting saved transfer state", () => {
  const input = ownershipTransferSchema.parse({
    targetId: "target",
    targetUsername: "target",
    confirmationSlug: "team",
    formerOwnerRole: "member",
    expectedUpdatedAt: time,
  });
  const saved = {
    organization: { ...organization, ownerId: "target", updatedAt: later },
    role: "member",
    owner: { id: "target", username: "target", displayName: "Target", avatarUrl: null },
    previousOwnerId: "owner",
  };
  expect(confirmOwnershipTransfer(saved, organization, "owner", input)).not.toBeNull();
  for (const extra of [
    { role: "admin" },
    { previousOwnerId: "other" },
    { owner: { ...saved.owner, username: "other" } },
    { organization: { ...saved.organization, ownerId: "other" } },
    { organization: { ...saved.organization, updatedAt: time } },
    { organization: { ...saved.organization, name: "Changed" } },
  ])
    expect(
      confirmOwnershipTransfer({ ...saved, ...extra }, organization, "owner", input),
    ).toBeNull();
});
it("does not query private history anonymously or with forged/repeated cursor filters", async () => {
  mocks.session.mockResolvedValue(null);
  expect(
    renderToStaticMarkup(await HistoryPage({ params: Promise.resolve({ id: "org" }) })),
  ).toContain("/auth/login");
  expect(mocks.history).not.toHaveBeenCalled();
  mocks.session.mockResolvedValue({ id: "owner", role: "user" });
  await HistoryPage({
    params: Promise.resolve({ id: "org" }),
    searchParams: Promise.resolve({ before: ["a", "b"] }),
  });
  expect(mocks.history).not.toHaveBeenCalled();
  await HistoryPage({
    params: Promise.resolve({ id: "org" }),
    searchParams: Promise.resolve({ before: "audit" }),
  });
  expect(mocks.history).toHaveBeenCalledWith("org", { id: "owner", role: "user" }, "audit");
  expect((await generateMetadata()).robots.index).toBe(false);
});
