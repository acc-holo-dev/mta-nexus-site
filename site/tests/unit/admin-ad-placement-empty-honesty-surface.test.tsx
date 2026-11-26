import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { adminAdPlacementCopy } from "../../src/features/moderation/admin-ad-placement-i18n";
import { AdminAdPlacementSection } from "../../src/features/moderation/admin-home";
import { getDictionary } from "../../src/lib/i18n";

describe("admin ad placement empty vs load-failure honesty", () => {
  it("shows ErrorState with retry when inventory load failed", () => {
    const copy = adminAdPlacementCopy("en");
    const markup = renderToStaticMarkup(
      <AdminAdPlacementSection
        locale="en"
        slots={null}
        rendererEnabled={false}
        retryHref="/admin"
      />,
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain(copy.loadUnavailable);
    expect(markup).toContain(copy.loadUnavailableHint);
    expect(markup).toContain(getDictionary("en").errors.retry);
    expect(markup).toContain('href="/admin"');
    expect(markup).not.toContain(copy.emptyTitle);
  });

  it("shows EmptyState only for a successful empty inventory", () => {
    const copy = adminAdPlacementCopy("en");
    const markup = renderToStaticMarkup(
      <AdminAdPlacementSection locale="en" slots={[]} rendererEnabled={false} retryHref="/admin" />,
    );

    expect(markup).toContain(copy.emptyTitle);
    expect(markup).toContain(copy.emptyDescription);
    expect(markup).not.toContain(copy.loadUnavailable);
    expect(markup).not.toContain('role="alert"');
  });
});
