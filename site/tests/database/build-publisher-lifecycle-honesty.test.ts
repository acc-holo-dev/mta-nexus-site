import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { formatNotification } from "../../src/lib/notification-copy";

const reviewCopy = { approved: "", rejected: "", version: "", notes: "" };

it("deep-links publisher review and lifecycle notices to the concrete workspace build", () => {
  const notices = readFileSync(
    resolve("site/packages/db/src/repositories/build-publisher-notices.ts"),
    "utf8",
  );
  expect(notices).toContain("function publisherBuildHref(productId: string, buildId: string)");
  expect(notices).toMatch(
    /return `\/workspace\/resources\/\$\{encodeURIComponent\(productId\)\}\/builds\/\$\{encodeURIComponent\(buildId\)\}`;/u,
  );
  const moderation = readFileSync(
    resolve("site/packages/db/src/repositories/builds-moderation.ts"),
    "utf8",
  );
  expect(moderation).toMatch(
    /`\/workspace\/resources\/\$\{product\.id\}\/builds\/\$\{reviewed\.id\}`/u,
  );
  expect(moderation).not.toMatch(/`\/workspace\/resources\/\$\{product\.id\}`\}, 'system'/u);
  const lifecycle = readFileSync(
    resolve("site/packages/db/src/repositories/builds-lifecycle.ts"),
    "utf8",
  );
  expect(lifecycle).toContain("notifyProductManagersWithin");
  expect(lifecycle).toContain('event: "quarantined"');
  expect(lifecycle).toContain('event: "restored"');
});

it.each(["en", "ru"] as const)(
  "localizes publisher quarantine and restore notices without malware invention in %s",
  (locale) => {
    const quarantined = formatNotification(
      {
        title: "Resource build quarantined",
        message: "stored",
        data: {
          kind: "build_lifecycle",
          event: "quarantined",
          resourceTitle: "Drift Tools",
          version: "3.1.0",
          productId: "prd_a",
          buildId: "bld_a",
        },
      },
      reviewCopy,
      locale,
    );
    const restored = formatNotification(
      {
        title: "Resource build restored",
        message: "stored",
        data: {
          kind: "build_lifecycle",
          event: "restored",
          resourceTitle: "Drift Tools",
          version: "3.1.0",
          productId: "prd_a",
          buildId: "bld_a",
        },
      },
      reviewCopy,
      locale,
    );
    expect(quarantined.title.toLowerCase()).toContain(locale === "ru" ? "карантин" : "quarantined");
    expect(quarantined.message).toContain("Drift Tools");
    expect(quarantined.message.toLowerCase()).not.toMatch(/malware|вирус|троян/u);
    expect(restored.title.toLowerCase()).toContain(locale === "ru" ? "восстанов" : "restored");
    expect(restored.message).toContain("3.1.0");
  },
);
