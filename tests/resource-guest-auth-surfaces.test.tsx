import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { LocaleProvider } from "../site/src/components/locale-context";
import { AddResourceToCart } from "../site/src/components/resource-cart-controls";
import { ResourceReleaseWatchControl } from "../site/src/components/resource-release-watch-control";
import { getDictionary } from "../site/src/lib/i18n";

vi.mock("next/navigation", () => ({
  usePathname: () => "/market/resource",
  useRouter: () => ({ refresh() {} }),
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

function htmlFrom(node: ReactNode) {
  return renderToStaticMarkup(<LocaleProvider locale="en">{node}</LocaleProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
});

it("offers login and register for guest cart intent with a preserved return path", () => {
  const html = htmlFrom(
    <AddResourceToCart productId="prd_a" signedIn={false} returnPath="/market/detail-resource" />,
  );
  expect(html).toContain('href="/auth/login?next=%2Fmarket%2Fdetail-resource"');
  expect(html).toContain('href="/auth/register?next=%2Fmarket%2Fdetail-resource"');
  expect(html).toContain(getDictionary("en").workspace.createAccount);
});

it("offers login and register on the guest release-watch surface", () => {
  const html = htmlFrom(
    <ResourceReleaseWatchControl
      guest
      returnPath="/market/resource"
      watch={{ productId: "prd_a", enabled: false, revision: 0, updatedAt: null }}
    />,
  );
  expect(html).toContain('href="/auth/login?next=%2Fmarket%2Fresource"');
  expect(html).toContain('href="/auth/register?next=%2Fmarket%2Fresource"');
  expect(html).toContain(getDictionary("en").workspace.createAccount);
});
