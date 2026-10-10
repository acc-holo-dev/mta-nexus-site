import type React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getDictionary } from "../lib/i18n";
import { LocaleProvider } from "./locale-context";
import { SupportCenter } from "./support-center";

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
        <SupportCenter staffMode />
      </LocaleProvider>,
    );
    expect(staff).toContain(copy.staffFilters);
    expect(staff).toContain(copy.filterStatus);
    expect(staff).toContain(copy.allStatuses);
    expect(staff).toContain(copy.allCategories);
    expect(staff).toContain('value="resolved"');
    expect(staff).toContain('value="payment"');

    const customer = renderToStaticMarkup(
      <LocaleProvider locale={locale}>
        <SupportCenter />
      </LocaleProvider>,
    );
    expect(customer).toContain(copy.allStatuses);
    expect(customer).toContain(copy.allCategories);
    expect(customer).toContain('action="/support"');
    expect(staff).toContain('action="/admin/support"');
  });
});
