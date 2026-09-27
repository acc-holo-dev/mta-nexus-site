import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getDictionary } from "../apps/web/src/lib/i18n";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("server experience UI", () => {
  it("keeps public server detail locale-aware without changing live-data authority", () => {
    const page = read("apps/web/src/app/servers/[slug]/page.tsx");

    expect(page).toContain("getRequestLocale");
    expect(page).toContain("dictionary.serverDetail");
    expect(page).toContain("mtaMasterDirectoryService.getDirectory()");
    expect(page).toContain("matchesMtaEndpoint(server, item)");
    expect(page).toContain(
      "<ServerHistoryPanel history={history} locale={locale} />",
    );
    expect(page).toContain(
      "<ServerUpdatesPanel updates={serverUpdates} locale={locale} />",
    );
  });

  it("preserves canonical server management authority", () => {
    const page = read(
      "apps/web/src/app/workspace/servers/[id]/page.tsx",
    );

    expect(page).toContain(
      "await serverService.canManageServer(server, user)",
    );
    expect(page).toContain("getRequestLocale");
    expect(page).toContain("getDictionary(locale).serverManagement");
  });

  it("hardens authenticated server mutations and follow state requests", () => {
    const details = read(
      "apps/web/src/components/server-details-form.tsx",
    );
    const follow = read(
      "apps/web/src/components/server-follow-button.tsx",
    );
    const claim = read(
      "apps/web/src/components/server-claim-control-panel.tsx",
    );

    for (const source of [details, follow, claim]) {
      expect(source).toContain('credentials: "same-origin"');
      expect(source).toContain('cache: "no-store"');
      expect(source).toContain("AbortSignal.timeout");
    }

    expect(details).toContain("dictionary.serverManagement");
    expect(follow).toContain("dictionary.follow");
    expect(claim).toContain("dictionary.serverClaim");
  });

  it("localizes history, update, follow, claim, and management surfaces", () => {
    const en = getDictionary("en");
    const ru = getDictionary("ru");

    expect(en.serverDetail.connect).not.toBe(ru.serverDetail.connect);
    expect(en.serverManagement.save).not.toBe(ru.serverManagement.save);
    expect(en.serverClaim.verify).not.toBe(ru.serverClaim.verify);
    expect(en.serverHistory.title).not.toBe(ru.serverHistory.title);
    expect(en.serverUpdates.title).not.toBe(ru.serverUpdates.title);
    expect(en.follow.follow).not.toBe(ru.follow.follow);
  });
});
