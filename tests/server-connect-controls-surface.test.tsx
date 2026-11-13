import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ServerConnectControls } from "../site/src/components/server-connect-controls";
import { getDictionary } from "../site/src/lib/i18n";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

describe("ServerConnectControls", () => {
  it.each(["en", "ru"] as const)(
    "links the connect action to the honest connect-intent hint in %s",
    (locale) => {
      const detail = getDictionary(locale).serverDetail;
      const html = renderToStaticMarkup(
        <ServerConnectControls
          address="203.0.113.50:22003"
          connectUri="mtasa://203.0.113.50:22003"
          name="Example server"
          locale={locale}
          connectLabel={detail.connect}
          connectHint={detail.connectHint}
        />,
      );

      expect(html).toContain(detail.connectHint);
      expect(html).toContain('href="mtasa://203.0.113.50:22003"');
      expect(html).toMatch(/aria-describedby="[^"]+"/);
      expect(html).toMatch(/id="[^"]+"/);
      expect(html).toContain('role="status"');
      expect(html).toMatch(/cannot verify|не подтверждает/u);
      expect(html).toContain("min-h-11");
    },
  );

  it("omits described-by wiring when no connect hint is provided", () => {
    const html = renderToStaticMarkup(
      <ServerConnectControls
        address="203.0.113.50:22003"
        connectUri="mtasa://203.0.113.50:22003"
        name="Example server"
        connectLabel="Open in MTA"
      />,
    );

    expect(html).not.toContain("aria-describedby");
    expect(html).not.toMatch(/connect intent|намерение подключения/u);
  });

  it("locks copy address CTA to size=touch / min-h-11 without size=sm", () => {
    const source = read("site/src/components/server-connect-controls.tsx");
    expect(source).toContain('size="touch"');
    expect(source).toContain("min-h-11");
    expect(source).toMatch(/min-h-11|size="touch"/u);
    expect(source).not.toContain('size="sm"');
    expect(source).not.toContain("min-h-10");
  });
});
