import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { noticeStoredTitles } from "@nexus/domain";
import { expect, it } from "vitest";
import { canonicalNoticeTitle } from "../../src/features/notifications/notification-copy";

it("keeps bilingual slash titles with English canonical segments for remapping", () => {
  const source = readFileSync(resolve("site/packages/domain/src/notice-stored-titles.ts"), "utf8");
  expect(source).toContain("EN / RU");
  expect(source).not.toMatch(/locale\s*===/u);
  expect(canonicalNoticeTitle(noticeStoredTitles.newServerUpdate)).toBe("New server update");
  expect(canonicalNoticeTitle(noticeStoredTitles.newFollower)).toBe("New Follower");
  expect(canonicalNoticeTitle(noticeStoredTitles.passwordResetCompleted)).toBe(
    "Password reset completed",
  );
  expect(canonicalNoticeTitle(noticeStoredTitles.verificationApproved)).toBe(
    "Verification approved",
  );
});
