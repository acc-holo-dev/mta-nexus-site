import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { OrganizationWorkspacePanel } from "../apps/web/src/components/organization-workspace";
import type { OrganizationWorkspace } from "../apps/web/src/lib/organization-workspace-contract";
import { getOrganizationCopy } from "../apps/web/src/lib/organization-workspace-copy";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/workspace/organizations/org",
}));

/** Honesty lock: organization workspace soft muted readonly → ErrorState alert. */
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/components/organization-workspace.tsx"),
  "utf8",
);

const workspace: OrganizationWorkspace = {
  organization: {
    id: "org",
    slug: "team",
    name: "Team",
    description: "Description",
    logoUrl: "",
    websiteUrl: "",
    ownerId: "owner",
    isVerified: false,
    updatedAt: "2026-10-10T12:00:00.000Z",
  },
  role: "member",
  owner: { id: "owner", username: "owner", displayName: "Owner", avatarUrl: null },
  members: [
    {
      id: "member",
      username: "member",
      displayName: "Member",
      avatarUrl: null,
      role: "member",
      managesServers: false,
      joinedAt: "2026-10-10T12:00:00.000Z",
    },
  ],
  page: 1,
  hasMore: false,
};

it("locks organization workspace readonly notice to ErrorState without soft muted caption", () => {
  expect(source).toContain('import { Avatar, Button, EmptyState, ErrorState } from "@nexus/ui"');
  expect(source).toContain('id="organization-workspace-readonly"');
  expect(source).toMatch(
    /\{!manageable && <ErrorState id="organization-workspace-readonly" title=\{copy\.readOnly\} \/>\}/u,
  );
  expect(source).not.toContain(
    'className="nexus-panel p-4 text-sm text-muted">{copy.readOnly}</p>',
  );
});

it.each(["en", "ru"] as const)(
  "renders organization workspace readonly through ErrorState alert in %s",
  (locale) => {
    const copy = getOrganizationCopy(locale);
    const markup = renderToStaticMarkup(
      <OrganizationWorkspacePanel initial={workspace} locale={locale} actorId="member" query="" />,
    );
    expect(markup).toContain(copy.readOnly);
    expect(markup).toContain('id="organization-workspace-readonly"');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("bg-danger-soft");
    expect(markup).not.toContain('class="nexus-panel p-4 text-sm text-muted"');
  },
);
