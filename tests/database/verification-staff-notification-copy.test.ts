import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { formatNotification } from "../../apps/web/src/lib/notification-copy";

const reviewCopy = { approved: "", rejected: "", version: "", notes: "" };

it("deep-links staff verification notices to the focused queue card", () => {
  const source = readFileSync(
    resolve("packages/db/src/repositories/verification-notification-delivery.ts"),
    "utf8",
  );
  expect(source).toMatch(/verificationId=\$\{encodeURIComponent\(verificationRequestId\)\}/u);
  expect(source).toMatch(/#verification-\$\{encodeURIComponent\(verificationRequestId\)\}/u);
  expect(source).not.toContain(
    'const VERIFICATION_PENDING_LINK = "/admin?verificationView=pending&verificationPage=1"',
  );
});

it.each(["en", "ru"] as const)(
  "localizes server ownership staff and resolution notices without raw IDs in %s",
  (locale) => {
    const staff = formatNotification(
      {
        title: "Server ownership proof requires review",
        message: "A verified server control proof is awaiting review.",
      },
      reviewCopy,
      locale,
    );
    const approved = formatNotification(
      {
        title: "Verification approved",
        message: "Server ownership verification was approved.",
      },
      reviewCopy,
      locale,
    );
    expect(staff.title).toContain(locale === "ru" ? "сервера" : "Server ownership");
    expect(approved.message).not.toMatch(/srv_|ver_/u);
    expect(approved.message).toContain(locale === "ru" ? "одобрено" : "approved");
  },
);
