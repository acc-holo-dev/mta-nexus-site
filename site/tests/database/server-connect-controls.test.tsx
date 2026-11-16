import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ServerConnectControls } from "../../src/features/servers/components/server-connect-controls";

describe("ServerConnectControls accessibility", () => {
  it("exposes a focusable connect action without an aria-hidden clipboard input", () => {
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

    expect(html).not.toContain('aria-label="Server address: Nexus Drift"');
    expect(html).not.toMatch(/<input[^>]*aria-hidden="true"/u);
    expect(html).toContain('aria-label="Open in MTA: Nexus Drift"');
    expect(html).toContain("focus-visible:ring-2");
  });

  it("keeps a labeled address field when showAddressField is enabled", () => {
    const html = renderToStaticMarkup(
      createElement(ServerConnectControls, {
        address: "192.0.2.1:22003",
        connectUri: "mtasa://192.0.2.1:22003",
        name: "Nexus Drift",
        locale: "en",
        connectLabel: "Open in MTA",
        showAddressField: true,
      }),
    );

    expect(html).toContain('aria-label="Server address: Nexus Drift"');
    expect(html).toContain('value="192.0.2.1:22003"');
  });
});
