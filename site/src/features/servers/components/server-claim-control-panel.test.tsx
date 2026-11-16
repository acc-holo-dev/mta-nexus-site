import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "../../../lib/i18n";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
}));

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useRef: (initial: unknown) => ({ current: initial }),
  useEffect: () => {},
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.slots)) {
      harness.slots[index] = typeof initial === "function" ? (initial as () => unknown)() : initial;
    }
    return [
      harness.slots[index],
      (value: unknown) => {
        harness.slots[index] = typeof value === "function" ? value(harness.slots[index]) : value;
      },
    ];
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/servers/demo",
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock("../../../components/locale-context", async () => {
  const { getDictionary } = await import("../../../lib/i18n");
  return {
    useNexusLocale: () => ({
      locale: "en" as const,
      dictionary: getDictionary("en"),
    }),
  };
});

import { ServerClaimControlPanel } from "./server-claim-control-panel";

function resetHarness() {
  harness.cursor = 0;
  harness.slots.length = 0;
}

beforeEach(resetHarness);

describe("server claim control panel honesty", () => {
  it("exposes create control with min-h-11 touch target", () => {
    const copy = getDictionary("en").serverClaim;
    const html = renderToStaticMarkup(
      createElement(ServerClaimControlPanel, {
        serverId: "srv_a",
        serverName: "Demo",
        expectedActorId: null,
      }),
    );
    expect(html).toContain(copy.title);
    expect(html).toContain(copy.create);
    expect(html).toContain("min-h-11");
    expect(html).not.toContain("min-h-10");
    expect(html).not.toContain('role="alert"');
  });

  it("renders ErrorState for claim errors instead of a plain alert paragraph", () => {
    const copy = getDictionary("en").serverClaim;
    // challenge, state, error, requiresLogin
    ServerClaimControlPanel({
      serverId: "srv_a",
      serverName: "Demo",
    } as never);
    harness.slots[2] = copy.createUnavailable;
    harness.cursor = 0;
    const html = renderToStaticMarkup(
      createElement(ServerClaimControlPanel, {
        serverId: "srv_a",
        serverName: "Demo",
        expectedActorId: null,
      }),
    );
    expect(html).toContain(copy.createUnavailable);
    expect(html).toContain('role="alert"');
    expect(html).toContain("bg-danger-soft");
    expect(html).not.toContain('class="text-xs text-warning"');
  });
});
