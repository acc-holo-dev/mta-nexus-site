import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ServerConnectControls } from "../apps/web/src/components/server-connect-controls";

describe("ServerConnectControls accessibility", () => {
  it("labels the clipboard fallback field and exposes a focusable connect action", () => {
    const html = renderToStaticMarkup(
      createElement(ServerConnectControls, {
        address: "192.0.2.1:22003",
        connectUri: "mtasa://192.0.2.1:22003",
        name: "Nexus Drift",
        locale: "en",
        connectLabel: "Open in MTA",
        connectHint: "Connect intent only.",
      }),
    );

    expect(html).toContain('aria-label="Server address: Nexus Drift"');
    expect(html).toContain('aria-label="Open in MTA: Nexus Drift"');
    expect(html).toContain("focus-visible:ring-2");
  });
});
