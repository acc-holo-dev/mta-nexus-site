import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { formatNotification } from "../../apps/web/src/lib/notification-copy";

const reviewCopy = { approved: "", rejected: "", version: "", notes: "" };
const caseId = `sup_${"a".repeat(24)}`;

it("stores support requester notices with structured data and no raw case id in the message", () => {
  const source = readFileSync(
    resolve("packages/db/src/repositories/support-requester-notice.ts"),
    "utf8",
  );
  expect(source).toContain('kind: "support_requester"');
  expect(source).toContain("subject");
  expect(source).not.toMatch(/Support case \$\{supportCase\.id\}/u);
  expect(source).toMatch(/\/support\/\$\{encodeURIComponent\(supportCase\.id\)\}/u);
});

it.each(["en", "ru"] as const)(
  "localizes structured support requester notices with the subject in %s",
  (locale) => {
    const notice = formatNotification(
      {
        title: "Support case activity",
        message: "Support replied to your case. (Billing help)",
        data: {
          kind: "support_requester",
          event: "reply",
          caseId,
          subject: "Billing help",
        },
      },
      reviewCopy,
      locale,
    );
    expect(notice.message).toContain("Billing help");
    expect(notice.message).not.toContain(caseId);
    expect(notice.title.toLowerCase()).toContain(locale === "ru" ? "обращен" : "support");
  },
);

it("keeps legacy Support case id: event. rows localized without echoing the id", () => {
  const notice = formatNotification(
    {
      title: "Support case activity",
      message: `Support case ${caseId}: closed.`,
      data: null,
    },
    reviewCopy,
    "en",
  );
  expect(notice.message).toBe("Support closed your case.");
  expect(notice.message).not.toContain(caseId);
});
