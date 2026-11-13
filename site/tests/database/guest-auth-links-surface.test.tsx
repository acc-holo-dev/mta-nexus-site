import type React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { communityReportCopy } from "../../src/lib/community-report-copy";
import { getDictionary } from "../../src/lib/i18n";

const harness = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0 }));
vi.mock("next/navigation", () => ({ usePathname: () => "/articles/guide" }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("react", async (importOriginal) => {
  const React = await importOriginal<typeof import("react")>();
  return {
    ...React,
    useState: (initial: unknown) => {
      const index = harness.cursor++;
      if (!(index in harness.slots)) {
        const resolved = typeof initial === "function" ? (initial as () => unknown)() : initial;
        harness.slots[index] = index === 2 && resolved === false ? true : resolved;
      }
      return [
        harness.slots[index],
        (value: unknown) => {
          harness.slots[index] = value;
        },
      ];
    },
    useEffect: (effect: () => undefined | (() => void)) => {
      effect();
    },
  };
});

import { CommunityReportForm } from "../../src/components/community-report-form";

beforeEach(() => {
  harness.slots = [];
  harness.cursor = 0;
});

it("shows guest login and create-account links when the report panel is open", () => {
  const html = renderToStaticMarkup(
    <CommunityReportForm targetType="comment" targetId="comment" locale="en" actorId={null} />,
  );
  expect(html).toContain(communityReportCopy("en").reportTitle);
  expect(html).toContain('href="/auth/login?next=%2Farticles%2Fguide"');
  expect(html).toContain('href="/auth/register?next=%2Farticles%2Fguide"');
  expect(html).toContain(getDictionary("en").workspace.createAccount);
});
