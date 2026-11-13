import type React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getDictionary } from "../lib/i18n";
import { LocaleProvider } from "./locale-context";
import { SupportCenter } from "./support-center";

vi.mock("next/navigation", () => ({ usePathname: () => "/support" }));

vi.mock("next/link", async () => {
  const ReactModule = await import("react");
  return {
    default: ({
      href,
      children,
      ...props
    }: {
      href: string;
      children?: React.ReactNode;
      [key: string]: unknown;
    }) => ReactModule.createElement("a", { href, ...props }, children),
  };
});

describe("staff support queue UI", () => {
  it.each(["en", "ru"] as const)("localizes requester and staff filters in %s", (locale) => {
    const copy = getDictionary(locale).support;
    const staff = renderToStaticMarkup(
      <LocaleProvider locale={locale}>
        <SupportCenter actorId="usr_member" staffMode />
      </LocaleProvider>,
    );
    expect(staff).toContain(`<search aria-label="${copy.staffFilters}"`);
    expect(staff).toContain(copy.staffFilters);
    expect(staff).toContain(copy.filterStatus);
    expect(staff).toContain(copy.allStatuses);
    expect(staff).toContain(copy.allCategories);
    expect(staff).toContain('value="resolved"');
    expect(staff).toContain('value="payment"');

    const customer = renderToStaticMarkup(
      <LocaleProvider locale={locale}>
        <SupportCenter
          actorId="usr_member"
          initialContext={{
            productId: `prd_${"a".repeat(24)}`,
            buildId: `bld_${"b".repeat(24)}`,
          }}
        />
      </LocaleProvider>,
    );
    expect(customer).toContain(copy.attachedContext);
    expect(customer).toContain(copy.contextResource);
    expect(customer).toContain(copy.contextBuild);
    expect(customer).toContain(copy.removeContext);
    expect(customer).toContain(copy.allStatuses);
    expect(customer).toContain(copy.allCategories);
    expect(customer).toContain("focus-visible:ring-2");
    expect(customer).toContain('action="/support"');
    expect(customer).toContain("min-w-0 max-w-5xl");
    expect(customer).toContain("overflow-x-clip");
    expect(staff).toContain('action="/admin/support"');
    expect(staff).toContain("overflow-x-clip");
  });
});
