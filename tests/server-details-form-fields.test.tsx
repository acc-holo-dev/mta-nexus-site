import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => undefined }),
}));
vi.mock("../apps/web/src/components/locale-context", async () => {
  const { getDictionary } = await import("../apps/web/src/lib/i18n");
  return {
    useNexusLocale: () => ({ locale: "en", dictionary: getDictionary("en") }),
  };
});
vi.mock("@nexus/ui", async () => {
  const { createElement } = await import("react");
  return {
    Button: ({ children, type }: { children: ReactNode; type?: "button" | "submit" }) =>
      createElement("button", { type }, children),
  };
});

import { ServerDetailsForm } from "../apps/web/src/components/server-details-form";
import RegisterServerPage from "../apps/web/src/app/workspace/servers/new/page";

describe("server forms use the same editable MTA metadata", () => {
  it("renders persisted HTTP port and map in the owner editor", () => {
    const html = renderToStaticMarkup(createElement(ServerDetailsForm, {
      server: {
        id: "srv_1",
        name: "Nexus Racing",
        ipAddress: "203.0.113.7",
        port: 22003,
        httpPort: 22006,
        gameMode: "roleplay",
        mapName: "Los Santos",
        visibility: "public",
      },
    }));
    expect(html).toMatch(/name="httpPort"[^>]*value="22006"/u);
    expect(html).toMatch(/name="mapName"[^>]*value="Los Santos"/u);
    expect(html).toContain("HTTP port");
    expect(html).toContain("Map name");
  });

  it("defaults a legacy unfilled HTTP port without hiding map editing", () => {
    const html = renderToStaticMarkup(createElement(ServerDetailsForm, {
      server: {
        id: "srv_2",
        name: "Legacy",
        ipAddress: "203.0.113.8",
        port: 22003,
        visibility: "unlisted",
      },
    }));
    expect(html).toMatch(/name="httpPort"[^>]*value="22005"/u);
    expect(html).toMatch(/name="mapName"[^>]*value=""/u);
  });

  it("makes map name available when registering a new server", () => {
    const html = renderToStaticMarkup(createElement(RegisterServerPage));
    expect(html).toContain('name="mapName"');
    expect(html).toContain("Map name");
    expect(html).toContain('name="httpPort"');
  });
});
