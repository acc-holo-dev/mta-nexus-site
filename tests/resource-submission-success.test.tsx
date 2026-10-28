import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getDictionary } from "../apps/web/src/lib/i18n";

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({
      href,
      children,
      ...props
    }: {
      href: string;
      children: React.ReactNode;
      [key: string]: unknown;
    }) => React.createElement("a", { href, ...props }, children),
  };
});

import { ResourceSubmissionSuccess } from "../apps/web/src/components/resource-submission-success";

describe("resource submission success state", () => {
  it.each(["en", "ru"] as const)(
    "describes moderator review instead of claiming publication in %s",
    (locale) => {
      const html = renderToStaticMarkup(
        <ResourceSubmissionSuccess resultId="prd_review" locale={locale} />,
      );
      const copy = getDictionary(locale).publishing;

      expect(html).toContain(copy.submittedTitle);
      expect(html).toContain(copy.submittedDescription);
      expect(html).toContain('href="/workspace/resources/prd_review"');
      if (locale === "en") {
        expect(copy.submittedTitle).toBe("Resource submitted for review");
        expect(copy.submittedDescription).toContain("moderator approval");
      } else {
        expect(copy.submittedDescription).toContain("одобрения модератора");
      }
      expect(html).not.toContain("Resource published");
      expect(html).not.toContain("Ресурс опубликован");
    },
  );
});
