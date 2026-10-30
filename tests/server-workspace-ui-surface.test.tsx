import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getDictionary } from "../apps/web/src/lib/i18n";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => undefined }),
}));
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children }: { href: string; children: ReactNode }) =>
      React.createElement("a", { href }, children),
  };
});

const localeState = vi.hoisted(() => ({
  locale: "en" as "en" | "ru",
}));

vi.mock("../apps/web/src/components/locale-context", async () => {
  const { getDictionary } = await import("../apps/web/src/lib/i18n");
  return {
    useNexusLocale: () => ({
      locale: localeState.locale,
      dictionary: getDictionary(localeState.locale),
    }),
  };
});

vi.mock("@nexus/ui", async () => {
  const { createElement } = await import("react");
  return {
    Button: ({
      children,
      type,
      isLoading,
      variant,
      disabled,
      onClick,
      className,
    }: {
      children: ReactNode;
      type?: "button" | "submit";
      isLoading?: boolean;
      variant?: string;
      disabled?: boolean;
      onClick?: () => void;
      className?: string;
    }) =>
      createElement(
        "button",
        {
          type,
          "data-ui": "button",
          "data-variant": variant || "primary",
          "aria-busy": isLoading || undefined,
          disabled: disabled || isLoading || undefined,
          onClick,
          className,
        },
        children,
      ),
    Input: ({
      label,
      id,
      error: _error,
      ...props
    }: {
      label?: string;
      id?: string;
      error?: string;
      name?: string;
      [key: string]: unknown;
    }) =>
      createElement(
        "div",
        { "data-ui": "input" },
        label ? createElement("label", { htmlFor: id }, label) : null,
        createElement("input", { id, ...props }),
      ),
  };
});

import RegisterServerPage from "../apps/web/src/app/workspace/servers/new/page";
import { ServerClaimControlPanel } from "../apps/web/src/components/server-claim-control-panel";
import { ServerDetailsForm } from "../apps/web/src/components/server-details-form";

describe("server workspace UI surface", () => {
  it.each(["en", "ru"] as const)(
    "registers servers with labeled @nexus/ui inputs in %s",
    (locale) => {
      localeState.locale = locale;
      const copy = getDictionary(locale).serverRegistration;
      const html = renderToStaticMarkup(createElement(RegisterServerPage));

      expect(html).toContain(copy.title);
      expect(html).toContain('data-ui="input"');
      expect(html).toContain('for="server-name"');
      expect(html).toContain('for="server-slug"');
      expect(html).toContain('for="server-ip-address"');
      expect(html).toContain('for="server-organization"');
      expect(html).toContain('for="server-visibility"');
      expect(html).toContain('for="server-description"');
      expect(html).toContain('aria-busy="false"');
      expect(html).toContain('data-ui="button"');
      expect(html).toContain(copy.create);
    },
  );

  it("keeps owner editor fields labeled and wired to the same names", () => {
    localeState.locale = "en";
    const copy = getDictionary("en").serverManagement;
    const html = renderToStaticMarkup(
      createElement(ServerDetailsForm, {
        server: {
          id: "srv_surface",
          name: "Surface Server",
          ipAddress: "203.0.113.9",
          port: 22003,
          httpPort: 22005,
          mapName: "San Fierro",
          visibility: "public",
        },
      }),
    );

    expect(html).toContain('data-ui="input"');
    expect(html).toContain('for="manage-server-name"');
    expect(html).toContain('for="manage-server-http-port"');
    expect(html).toContain('for="manage-server-visibility"');
    expect(html).toMatch(/name="httpPort"[^>]*value="22005"/u);
    expect(html).toContain(copy.save);
    expect(html).toContain('data-ui="button"');
  });

  it.each(["en", "ru"] as const)(
    "exposes claim controls through @nexus/ui buttons in %s",
    (locale) => {
      localeState.locale = locale;
      const copy = getDictionary(locale).serverClaim;
      const html = renderToStaticMarkup(
        createElement(ServerClaimControlPanel, {
          serverId: "srv_claim",
          serverName: "Claim Target",
        }),
      );

      expect(html).toContain(copy.title);
      expect(html).toContain(copy.create);
      expect(html).toContain('data-ui="button"');
      expect(html).toContain('data-variant="secondary"');
      expect(html).toContain('id="server-control-proof-heading"');
      expect(html).not.toContain("LoaderCircle");
    },
  );

  it("keeps RU and EN server workspace copy distinct", () => {
    const en = getDictionary("en");
    const ru = getDictionary("ru");
    expect(en.serverRegistration.title).not.toBe(ru.serverRegistration.title);
    expect(en.serverRegistration.create).not.toBe(ru.serverRegistration.create);
    expect(en.serverManagement.save).not.toBe(ru.serverManagement.save);
    expect(en.serverClaim.create).not.toBe(ru.serverClaim.create);
    expect(en.serverClaim.verify).not.toBe(ru.serverClaim.verify);
  });
});
