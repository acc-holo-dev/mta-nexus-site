import { renderToStaticMarkup } from "react-dom/server";
import { Circle } from "lucide-react";
import { describe, expect, it } from "vitest";
import { StatCard, TrustBadge } from "../packages/ui/src/platform";

describe("platform component non-text semantics", () => {
  it("keeps trust badge icons decorative because the visible label carries meaning", () => {
    const markup = renderToStaticMarkup(
      <TrustBadge variant="verifiedServer" label="Verified identity" />,
    );

    expect(markup).toContain("Verified identity");
    expect(markup).toContain('aria-hidden="true"');
  });

  it("keeps stat-card icons decorative because label and value carry the metric", () => {
    const markup = renderToStaticMarkup(
      <StatCard
        label="Active servers"
        value={42}
        icon={<Circle aria-label="decorative metric icon" />}
      />,
    );

    expect(markup).toContain("Active servers");
    expect(markup).toContain(">42<");
    expect(markup).toContain('aria-hidden="true"');
  });
});
