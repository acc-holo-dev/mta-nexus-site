import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/market" }));

import { Footer } from "../apps/web/src/components/footer";
import { getDictionary } from "../apps/web/src/lib/i18n";

describe("footer legal link reflow", () => {
  it.each(["en", "ru"] as const)(
    "wraps the legal link row so %s captions do not force a wider page",
    (locale) => {
      const dictionary = getDictionary(locale);
      const html = renderToStaticMarkup(<Footer locale={locale} />);

      expect(html).toContain("flex min-w-0 max-w-full flex-wrap");
      expect(html).toContain("overflow-x-clip");
      expect(html).toContain(dictionary.footer.communityRules);
      expect(html).toContain(dictionary.footer.copyright);
      expect(html).toContain('href="/support"');
      expect(html).toContain('href="/copyright"');
    },
  );
});
