import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MtaMasterServerDirectory } from "../../src/components/mta-master-server-directory";
import { getDictionary } from "../../src/lib/i18n";

describe("MTA master directory connect honesty", () => {
  it.each(["en", "ru"] as const)(
    "uses Open in MTA intent copy and keeps clipboard fallback available in %s",
    (locale) => {
      const copy = getDictionary(locale).servers;
      const html = renderToStaticMarkup(createElement(MtaMasterServerDirectory, { locale }));

      expect(copy.connect).toMatch(locale === "ru" ? /Открыть в MTA/u : /Open in MTA/u);
      expect(copy.connectHint).toMatch(locale === "ru" ? /не подтверждает/iu : /connect intent/iu);
      expect(copy.connectHint).not.toMatch(/verified play|подтверждённ(ую|ой) игр/iu);
      expect(html).toContain(copy.connectHint);
      expect(html).toContain(copy.network);
      expect(copy.copyUnavailable).toMatch(locale === "ru" ? /вручную/iu : /manually/iu);
    },
  );
});
