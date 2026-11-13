import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { formatNotification } from "../../site/src/lib/notification-copy";

const reviewCopy = { approved: "", rejected: "", version: "", notes: "" };

it("routes quarantined-build notices to library versions instead of Security Center", () => {
  const source = readFileSync(
    resolve("packages/db/src/repositories/build-incident-notification-delivery.ts"),
    "utf8",
  );
  expect(source).toContain("function buildIncidentDownloaderLink(productId: string)");
  expect(source).toContain("buildIncidentDownloaderLink(job.productId)");
  expect(source).toMatch(
    /return `\/workspace\/library\/\$\{encodeURIComponent\(productId\)\}\/versions`;/u,
  );
  expect(source).toContain('return "/workspace/library/updates"');
  expect(source).not.toMatch(/link:\s*"\/security"/u);
});

it.each(["en", "ru"] as const)(
  "localizes build-incident notices without inventing malware details in %s",
  (locale) => {
    const notice = formatNotification(
      {
        title: "Security notice for a downloaded build",
        message:
          "A build you downloaded was quarantined after a security review. Stop using that version and check for an updated release in your library.",
        data: {
          kind: "build_incident",
          buildId: "bld_a",
          productId: "prd_a",
          version: "1.2.3",
        },
      },
      reviewCopy,
      locale,
    );
    expect(notice.title.toLowerCase()).toContain(locale === "ru" ? "безопасн" : "security");
    expect(notice.message.toLowerCase()).toContain(locale === "ru" ? "карантин" : "quarantined");
    expect(notice.message.toLowerCase()).toContain(locale === "ru" ? "библиотек" : "library");
    expect(notice.message.toLowerCase()).not.toMatch(/malware|вирус|троян/u);
  },
);
