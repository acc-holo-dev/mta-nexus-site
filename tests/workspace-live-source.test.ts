import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("workspace live telemetry source", () => {
  it("uses the official MTA directory and keeps missing observations neutral", () => {
    const page = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/workspace/page.tsx"),
      "utf8",
    );

    expect(page).toContain(
      "mtaMasterDirectoryService.getDirectory().catch(() => null)",
    );
    expect(page).toContain("indexMtaObservations(directory?.servers ?? [])");
    expect(page).toContain("productRepository.listPublishedFreeByIds(");
    expect(page).toContain("licenseRepository.listActiveDownloadableByUser(user.id)");
    expect(page).toContain("collectLibraryEntries(entitlements, legacyLicenses)");
    expect(page).toContain("ownedServers.length > 0");
    expect(page).toContain("dictionary.servers.online");
    expect(page).toContain("dictionary.servers.offline");
    expect(page).toContain("dictionary.servers.unknown");
    expect(page).not.toContain("lastHeartbeatAt");
    expect(page).not.toContain("server.currentPlayers");
  });
});
