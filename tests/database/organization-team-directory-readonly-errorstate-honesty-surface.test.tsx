import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { OrganizationTeamDirectory } from "../../apps/web/src/components/organization-team-directory";
import type { OrganizationTeamPage } from "../../apps/web/src/lib/organization-team-contract";
import { getOrganizationCopy } from "../../apps/web/src/lib/organization-workspace-copy";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

/** Honesty lock: organization team directory soft muted readonly → ErrorState alert. */
let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "apps/web/src/components/organization-team-directory.tsx"),
  "utf8",
);

const data: OrganizationTeamPage = {
  organization: {
    id: "org",
    slug: "team",
    name: "Team",
    description: "",
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
      effectiveServerAccess: false,
      joinedAt: "2026-10-10T12:00:00.000Z",
    },
  ],
  hasMore: false,
  nextCursor: null,
};

it("locks organization team directory readonly notice to ErrorState without soft muted caption", () => {
  expect(source).toContain('import { EmptyState, ErrorState } from "@nexus/ui"');
  expect(source).toContain('id="organization-team-directory-readonly"');
  expect(source).toMatch(
    /<ErrorState id="organization-team-directory-readonly" title=\{team\.readOnly\} \/>/u,
  );
  expect(source).not.toContain('className="text-sm text-muted">{team.readOnly}</p>');
});

it.each(["en", "ru"] as const)(
  "renders organization team directory readonly through ErrorState alert in %s",
  (locale) => {
    const copy = getOrganizationCopy(locale);
    const markup = renderToStaticMarkup(
      <OrganizationTeamDirectory
        initial={data}
        filters={{ query: "" }}
        actorId="member"
        locale={locale}
      />,
    );
    expect(markup).toContain(copy.readOnly);
    expect(markup).toContain('id="organization-team-directory-readonly"');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("bg-danger-soft");
    expect(markup).not.toContain(`class="text-sm text-muted">${copy.readOnly}</p>`);
  },
);
