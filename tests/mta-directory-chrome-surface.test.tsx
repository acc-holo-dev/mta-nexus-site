import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getDictionary } from "../apps/web/src/lib/i18n";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => undefined }),
}));

import { ManagedServerVisibilityBatch } from "../apps/web/src/components/managed-server-visibility-batch";
import { MtaMasterServerDirectory } from "../apps/web/src/components/mta-master-server-directory";
import { serverWorkspaceCopy } from "../apps/web/src/lib/server-workspace-copy";

describe("MTA directory/visibility chrome", () => {
  it("renders directory controls with shared Button chrome", () => {
    const copy = getDictionary("en").servers;
    const html = renderToStaticMarkup(createElement(MtaMasterServerDirectory, { locale: "en" }));
    expect(html).toContain(copy.directory);
    expect(html).toContain("rounded-lg");
  });

  it.each(["en", "ru"] as const)(
    "renders visibility batch actions with shared Button chrome in %s",
    (locale) => {
      const copy = serverWorkspaceCopy(locale);
      const html = renderToStaticMarkup(
        createElement(ManagedServerVisibilityBatch, {
          locale,
          items: [{ id: "srv_a", name: "Alpha", card: "card" }],
        }),
      );
      expect(html).toContain(copy.selectAll);
      expect(html).toContain(copy.preview);
      expect(html).toContain("rounded-lg");
      expect(html).toContain("text-accent");
    },
  );
});
