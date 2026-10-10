import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("../apps/web/src/components/server-claim-control-panel", async () => {
  const { createElement } = await import("react");
  return {
    ServerClaimControlPanel: () => createElement("div", { "data-testid": "claim-controls" }),
  };
});
import { ServerClaimStatusPanel } from "../apps/web/src/components/server-claim-status-panel";
import {
  getServerClaimStatusCopy,
  serverClaimErrorMessage,
} from "../apps/web/src/lib/server-claim-status-view";
import type { ManagedServerClaimStatus } from "@nexus/db";
const render = (status: ManagedServerClaimStatus, locale: "en" | "ru" = "en") =>
  renderToStaticMarkup(
    <ServerClaimStatusPanel serverId="srv_a" serverName="Server" status={status} locale={locale} />,
  );
const request = {
  status: "pending" as const,
  createdAt: new Date("2026-10-10T12:30:00Z"),
  resolvedAt: null,
  isRequester: true,
  proofMatchesServer: true,
};
it.each(["en", "ru"] as const)(
  "renders pending status in %s and blocks duplicate challenges",
  (locale) => {
    const html = render({ isVerified: false, request }, locale);
    const copy = getServerClaimStatusCopy(locale);
    expect(html).toContain(copy.pending);
    expect(html).toContain(copy.yourRequest);
    expect(html).toContain("UTC");
    expect(html).toMatch(/datetime="2026-10-10T12:30:00.000Z"/i);
    expect(html).not.toContain('data-testid="claim-controls"');
  },
);
it.each(["approved", "rejected"] as const)(
  "allows a new proof after a closed %s request for an unverified server",
  (status) => {
    const html = render({
      isVerified: false,
      request: { ...request, status, resolvedAt: new Date("2026-10-10T13:00:00Z") },
    });
    expect(html).toContain(getServerClaimStatusCopy("en")[status]);
    expect(html).toContain('data-testid="claim-controls"');
    expect(html).toContain("Reviewed");
  },
);
it("uses the current server badge rather than an old approval to hide controls", () => {
  expect(render({ isVerified: true, request: null })).toContain("Server verified");
  expect(render({ isVerified: true, request: null })).not.toContain('data-testid="claim-controls"');
  expect(render({ isVerified: false, request: null })).toContain('data-testid="claim-controls"');
});
it("explains stale pending evidence while retaining the moderation boundary", () => {
  const html = render({
    isVerified: false,
    request: { ...request, proofMatchesServer: false, isRequester: false },
  });
  expect(html).toContain("no longer matches");
  expect(html).toContain("Request from another manager");
  expect(html).not.toContain('data-testid="claim-controls"');
});
it.each(["en", "ru"] as const)("localizes every known claim error in %s", (locale) => {
  const copy = getServerClaimStatusCopy(locale);
  for (const [code, message] of Object.entries(copy.errors))
    expect(
      serverClaimErrorMessage({ code, error: "Internal database detail" }, locale, "fallback"),
    ).toBe(message);
});
it.each([
  null,
  [],
  "raw",
  { error: "Secret detail" },
  { code: "UNKNOWN", error: "Internal message" },
  { code: "__proto__" },
])("never displays unknown response messages: %j", (body) =>
  expect(serverClaimErrorMessage(body, "ru", "Повторите попытку")).toBe("Повторите попытку"),
);
