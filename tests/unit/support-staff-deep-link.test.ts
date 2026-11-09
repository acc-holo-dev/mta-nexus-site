import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

const source = readFileSync(
  resolve("packages/db/src/repositories/support-notification-delivery.ts"),
  "utf8",
);

it("deep-links staff support notices to the case detail surface", () => {
  expect(source).toContain("function supportStaffCaseLink(caseId: string)");
  expect(source).toContain("supportStaffCaseLink(job.caseId)");
  expect(source).toContain("caseId: supportNotificationDeliveries.caseId");
  expect(source).toMatch(/return `\/admin\/support\/\$\{encodeURIComponent\(caseId\)\}`;/u);
  expect(source).not.toMatch(/link:\s*"\/admin\/support"/u);
});

it("keeps a safe fallback to the support queue for unsafe case ids", () => {
  expect(source).toContain('return "/admin/support"');
  expect(source).toContain("/^[A-Za-z0-9_-]+$/u.test(caseId)");
});
