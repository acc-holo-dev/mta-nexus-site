import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getDictionary } from "../../../lib/i18n";
import { ServerConnectControls } from "./server-connect-controls";

describe("ServerConnectControls", () => {
  it.each(["en", "ru"] as const)(
    "labels the protocol action as Open in MTA without claiming verified play in %s",
    (locale) => {
      const label = getDictionary(locale).serverDetail.connect;
      const hint = getDictionary(locale).serverDetail.connectHint;
      const html = renderToStaticMarkup(
        <ServerConnectControls
          address="203.0.113.9:22003"
          connectUri="mtasa://203.0.113.9:22003"
          name="Example"
          locale={locale}
          connectLabel={label}
          connectHint={hint}
          showAddressField
        />,
      );
      expect(html).toContain('href="mtasa://203.0.113.9:22003"');
      expect(html).toContain(label);
      expect(html).toContain(hint);
      expect(html).toContain('value="203.0.113.9:22003"');
      expect(html).toContain(getDictionary(locale).servers.copyAddress);
      expect(html).not.toMatch(/verified play|verified-play|подтверждённ(ую|ой) игр/iu);
    },
  );
});
