import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/market" }));

import { FooterContribute } from "../../src/components/footer-contribute";
import { getDictionary } from "../../src/lib/i18n";

it.each(["en", "ru"] as const)(
  "hides workspace contribute links until the session is known in %s",
  (locale) => {
    const dictionary = getDictionary(locale);
    const html = renderToStaticMarkup(<FooterContribute locale={locale} />);
    expect(html).toContain(dictionary.footer.contribute);
    expect(html).toContain(dictionary.nav.checkingSession);
    expect(html).not.toContain('href="/workspace/resources/new"');
    expect(html).not.toContain('href="/workspace/servers/new"');
  },
);
