import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getResourcePublisherNavCopy } from "../apps/web/src/lib/resource-publisher-nav-i18n";
import { getServerWorkspaceNavCopy } from "../apps/web/src/lib/server-workspace-nav-i18n";

const nav = vi.hoisted(() => ({
  pathname: "/workspace/resources/prd_a/media",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
}));

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({
      href,
      children,
      ...props
    }: {
      href: string;
      children: ReactNode;
      [key: string]: unknown;
    }) => React.createElement("a", { href, ...props }, children),
  };
});

import { ResourcePublisherWorkspaceNav } from "../apps/web/src/components/resource-publisher-workspace-nav";
import { ServerWorkspaceNav } from "../apps/web/src/components/server-workspace-nav";

describe("workspace publisher and server navigation", () => {
  beforeEach(() => {
    nav.pathname = "/workspace/resources/prd_a/media";
  });

  it.each(["en", "ru"] as const)("groups publisher sections with current page in %s", (locale) => {
    const copy = getResourcePublisherNavCopy(locale);
    const html = renderToStaticMarkup(
      <ResourcePublisherWorkspaceNav resourceId="prd_a" organizationId="org_a" locale={locale} />,
    );

    expect(html).toContain(`aria-label="${copy.navigation}"`);
    expect(html).toContain(copy.groupCard);
    expect(html).toContain(copy.groupVersions);
    expect(html).toContain(copy.groupCommerce);
    expect(html).toContain('href="/workspace/resources/prd_a/media"');
    expect(html).toContain('href="/workspace/resources/prd_a/activity"');
    expect(html).toContain("organizationId=org_a");
    expect(html).toContain('aria-current="page"');
    expect(html).toContain(`>${copy.media}</a>`);
  });

  it.each(["en", "ru"] as const)("marks server overview current and links observations in %s", (locale) => {
    nav.pathname = "/workspace/servers/srv_a";
    const copy = getServerWorkspaceNavCopy(locale);
    const html = renderToStaticMarkup(
      <ServerWorkspaceNav serverId="srv_a" locale={locale} />,
    );

    expect(html).toContain(`aria-label="${copy.navigation}"`);
    expect(html).toContain('href="/workspace/servers/srv_a/observations"');
    expect(html).toContain('href="/workspace/servers/srv_a/content"');
    expect(html).toContain(copy.observations);
    expect(html).toContain('aria-current="page"');
  });
});
