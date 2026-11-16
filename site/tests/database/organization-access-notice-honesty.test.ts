import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { formatNotification } from "../../src/lib/notification-copy";

const reviewCopy = { approved: "", rejected: "", version: "", notes: "" };

it("stores organization access notices with structured data and no raw org id in the message", () => {
  const source = readFileSync(
    resolve("site/packages/db/src/repositories/organization-access-notice.ts"),
    "utf8",
  );
  expect(source).toContain('kind: "organization_access"');
  expect(source).toContain("organizationName");
  expect(source).not.toMatch(/Organization \$\{organization\.id\}/u);
  expect(source).toMatch(
    /change === "removed" \|\| change === "left"[\s\S]*\/organizations\/\$\{encodeURIComponent\(organization\.slug\)\}/u,
  );
  expect(source).toMatch(
    /\/workspace\/organizations\/\$\{encodeURIComponent\(organization\.id\)\}/u,
  );
});

it.each(["en", "ru"] as const)(
  "localizes structured organization access notices with the org name in %s",
  (locale) => {
    const notice = formatNotification(
      {
        title: "Organization access changed",
        message: "You were added to the team. (Northwind)",
        data: {
          kind: "organization_access",
          event: "added",
          organizationId: "org_secret",
          organizationName: "Northwind",
          organizationSlug: "northwind",
        },
      },
      reviewCopy,
      locale,
    );
    expect(notice.message).toContain("Northwind");
    expect(notice.message).not.toContain("org_secret");
    expect(notice.title.toLowerCase()).toContain(locale === "ru" ? "организац" : "organization");
  },
);

it("keeps legacy Organization id: event. rows localized without echoing the id", () => {
  const notice = formatNotification(
    {
      title: "Organization access changed",
      message: "Organization org_legacy: removed.",
      data: null,
    },
    reviewCopy,
    "en",
  );
  expect(notice.message).toBe("Your team access was revoked.");
  expect(notice.message).not.toContain("org_legacy");
});
